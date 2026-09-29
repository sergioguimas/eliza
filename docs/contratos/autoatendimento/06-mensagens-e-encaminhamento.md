# 06 — Mensagens: encaminhamento, envio e escalonamento

> TO-BE · Contrato v1 · Zod: `mensagens.ts`, `ticket.ts` · ver [README](README.md)

## Visão

```txt
Evolution ──▶ /api/webhooks/whatsapp (Eliza)
                 │ autentica (sessão de segurança) e acha org pela instância
                 │ org.is_demo? ─────────────── sim ─▶ fluxo atual
                 │ ATENDENTE_URL vazia? ─────── sim ─▶ fluxo atual
                 │ autoatendimento_config ativo? não ─▶ fluxo atual
                 ▼ sim
          emite ticket (se não é deMim)
                 │
                 ▼  POST {ATENDENTE_URL}/v1/mensagens   (timeout 3 s)
          202 ─▶ fim (Eliza não responde nada ao cliente)
          erro/timeout ─▶ fluxo atual (fallback), só se não é deMim

atendente ──▶ POST /api/v1/autoatendimento/mensagens ──▶ gateway ──▶ Evolution
```

## Encaminhamento (Eliza → atendente)

Ramo novo em `api/webhooks/whatsapp/[[...slug]]/route.ts`, **depois** da
autenticação e da resolução de org que a sessão de segurança colocou, e
**antes** do classificador por palavra-chave. A lógica fica em
`lib/autoatendimento/encaminhar.ts`; o webhook só chama.

**Hoje o webhook descarta `fromMe` logo no começo.** Para orgs com o add-on
ativo, as mensagens `fromMe` passam a ser encaminhadas com `deMim: true`. O
atendente precisa delas para saber quando a equipe assumiu a conversa (D9).
Para orgs sem o add-on, o descarte continua como está.

Montagem de `MensagemEncaminhada`:

| Campo | Origem |
|---|---|
| `mensagemId` | `data.key.id` |
| `recebidaEm` | `data.messageTimestamp` (segundos) → ISO |
| `organizacao` | org resolvida, `{ id, name }` |
| `contato.telefone` | Mesma extração de número que o webhook já usa (inclui `remoteJidAlt`). Em `deMim`, é o destinatário (`remoteJid`) |
| `contato.nomeExibicao` | `data.pushName` se não é `deMim`; senão `null` |
| `conteudo` | Texto pela mesma extração atual (`extractMessageText`). Vazio → `{ tipo: "nao_suportado", tipoOriginal: <primeira chave de data.message> }` |
| `ticket` | `null` se `deMim`; senão emitido com `org`, `tel = contato.telefone`, `inst`, `msg = mensagemId` e TTL de 30 min |

Envio:

- Corpo serializado **uma vez**; a assinatura é sobre essa string exata:
  `hex(HMAC-SHA256(ATENDENTE_ENCAMINHAMENTO_SECRET, timestamp + "." + corpo))`,
  nos headers `X-Eliza-Assinatura` e `X-Eliza-Timestamp`.
- Timeout de 3 s (`AbortController`). Sem retentativa: a Evolution já
  retenta o webhook, e o atendente deduplica por `mensagemId`.
- Mensagem em grupo (`remoteJid` terminando em `@g.us`) e status/broadcast
  **não** são encaminhadas.

**Fallback:** em timeout, erro de rede ou resposta ≠ 202, e só se
`deMim = false`, cai no fluxo atual de palavra-chave. É uma decisão consciente
(D5): com o atendente fora, o cliente que responde "sim" ao lembrete continua
confirmando. Logar `[autoatendimento:encaminhar] fallback <motivo>`.

O webhook responde 200 à Evolution em todos os casos, como hoje.

## `POST /api/v1/autoatendimento/mensagens` (atendente → cliente)

Body `EnviarMensagemBody`. Autenticação normal (README §2).

1. `aa-msg-contato` e `aa-msg-org`.
2. Destino = telefone do ticket. Instância = `inst` do ticket, que precisa
   ainda ser a `whatsapp_instance_name` da org (se não for, `TICKET_INVALIDO`).
   **Não existe campo de destino no body.**
3. `gateway.enviarTexto({ orgId, telefone, texto })`.
4. Falha da Evolution → `WHATSAPP_INDISPONIVEL` (502).
5. Sucesso → `{ mensagemId }` com o id que a Evolution devolveu (`key.id` da
   resposta de `/message/sendText`), ou `null` se ela não devolver. O
   atendente usa esse id para reconhecer o próprio eco quando ele voltar como
   `deMim`.

O texto sai como está. A API não reescreve, não traduz e não aplica template.

## `lib/whatsapp/gateway.ts`

Único ponto do Eliza que conhece rotas da Evolution depois da F0:

```ts
enviarTexto(p: { orgId: string; telefone: string; texto: string }):
  Promise<{ ok: true; mensagemId: string | null } | { ok: false; motivo: string }>
```

Na F0 basta criar a função em cima do que `send-whatsapp.ts` já faz (resolver
instância, montar a chamada) e fazer `sendWhatsAppMessage` delegar para ela.
Migrar os outros pontos (`whatsapp-connect`, `whatsapp-messages`, demo) é
bom, mas **não** faz parte desta fase. Registrar como pendência.

## `POST /api/v1/autoatendimento/escalonamentos`

Body `EscalonarBody`. Não exige cliente identificado (ambíguo é justamente
quem mais escala).

1. `aa-escalar`.
2. Sem `contato_humano_telefone` na config → sucesso com
   `equipeNotificada: false`. O atendente avisa o cliente de outro jeito.
3. Com contato → `gateway.enviarTexto` para ele, **pela instância da org**:
   ```txt
   🙋 Atendimento pediu ajuda humana
   Cliente: <primeiroNome ou "não identificado"> (<telefone do ticket, formatado>)
   Motivo: <motivo>
   <resumo>
   ```
4. Falha no envio → `equipeNotificada: false` (não é erro para o atendente).

Na F0 não se grava tabela de escalonamentos. Quando o painel tiver uma fila,
cria-se a tabela.

## Aceite

- [ ] Org sem linha de config: webhook se comporta exatamente como antes (incluindo `fromMe` descartado).
- [ ] Org ativa: mensagem de texto chega ao atendente com assinatura válida e ticket que a API aceita.
- [ ] Org ativa, `fromMe`: encaminhada com `deMim: true` e `ticket: null`.
- [ ] Org ativa e atendente fora do ar: "sim" ao lembrete ainda confirma pelo fluxo antigo.
- [ ] Org demo com config ativa: nunca encaminha.
- [ ] Mensagem de grupo: nunca encaminha.
- [ ] Assinatura recalculada sobre o corpo recebido bate; corpo alterado em 1 byte não bate.
- [ ] `POST /mensagens` entrega no telefone do ticket e devolve `mensagemId`.
- [ ] Ticket da org A usado depois de a org A trocar de instância → 401.
- [ ] Escalonamento sem contato configurado → `equipeNotificada: false`, 200.
