# 07 — Ajustes para o atendente sola-agens (F1)

> TO-BE · Contrato v1, **revisão aditiva** (o header de versão continua `1`, ver C8) · ver [README](README.md)
> **Escrito em:** 2026-10-09 · **Origem do pedido:** `Projetos/sola-agens/specs/04-integracoes.md §6`
> (decisões A6, A8, B2, B3, M1, M3, M4 do `sola-agens/CONTRATO.md §10`)
> **Zod tocados:** `mensagens.ts`, `contexto.ts`, `cadastro.ts`, `comum/envelope.ts`

## Para quem executa

Mesmas regras do [README](README.md#para-quem-executa): os `.md` dizem **o que** e **por quê**; os
Zod são a forma exata. Onde este arquivo der um valor fechado, use o valor. Se o código contradisser
uma premissa daqui, o código vence: pare, registre e siga o que é correto.

O atendente agora tem nome: **sola-agens** (`Projetos/sola-agens`), plataforma da Sola que lê esta
OpenAPI e transforma as operações liberadas em ferramentas do LLM. Este contrato é o que o Eliza
precisa mudar para o agente Eliza da F1 do sola-agens funcionar. Nada aqui coloca LLM, prompt ou
lógica de conversa no Eliza (C1 continua valendo).

**Pré-requisito:** F0 do autoatendimento executada (está: `RELATORIO_AUTOATENDIMENTO_F0.md`).

## Resumo

| # | Mudança | Por quê |
|---|---|---|
| 1 | `x-atendente: true` nas operações que viram ferramenta | O sola-agens só expõe ao LLM o que o sistema marcou |
| 2 | `GET /cadastro/nome` → `{ existe }` | Identificação por nome sem dar acesso a cadastro (B3) |
| 3 | Motivos `numero_novo` e `falha_tecnica` no escalonamento | Os dois casos novos de escalonamento do agens |
| 4 | Áudio: encaminhar como `audio` e rota para baixar a mídia | O agens transcreve áudio e não tem (nem deve ter) a chave da Evolution (C3) |
| 5 | Campo `atendente` no contexto, com colunas novas em `autoatendimento_config` | Persona, tom, respostas, palavras e horas de pausa por org (B2, M1, M3, M4) |

---

## 1. Marcação `x-atendente`

Em `web/lib/openapi/autoatendimento.ts`, acrescentar `"x-atendente": true` à operação (mesmo nível
de `operationId`) **exatamente** nestas:

`listarServicos`, `listarProfissionais`, `consultarHorarios`, `listarAgendamentos`,
`criarAgendamento`, `remarcarAgendamento`, `cancelarAgendamento`, `confirmarAgendamento`,
`lerCadastro`, `criarCadastro`, `atualizarCadastro`, `verificarNomeCadastrado` (item 2).

**Nunca** em `obterContexto`, `enviarMensagem`, `escalarParaEquipe` e `baixarMidia` (item 4): essas o
agens chama por conta própria, e ele **recusa subir** se alguma delas vier marcada (o LLM não pode
mandar mensagem nem escalar sem passar pelo motor).

No `DESCRICAO_GERAL`, um parágrafo: "Operações com `x-atendente: true` são as que o atendente expõe
ao modelo como ferramenta; a descrição de cada uma é a instrução que o modelo lê." As descrições das
operações marcadas passam a ser lidas por um LLM: revisar se cada uma diz **quando** usar, não só o
que faz (a de `consultarHorarios` e a de `criarAgendamento` já dizem).

## 2. `GET /api/v1/autoatendimento/cadastro/nome`

**Para quê:** o cliente escreveu de um número sem cadastro (`desconhecido`) e disse o nome. O agens
precisa saber se esse nome já é cliente da org para **não** criar cadastro duplicado e chamar a
equipe para vincular o número novo. A resposta não pode virar acesso: quem diz "sou a Maria Silva"
de outro número não ganha nada da Maria.

Zod (`cadastro.ts`):

```ts
// GET /api/v1/autoatendimento/cadastro/nome?nome=...
export const VerificarNomeQuery = z.object({ nome: z.string().trim().min(3).max(120) }).strict()

export const VerificarNomeResposta = apiSuccess(z.object({ existe: z.boolean() }))
```

Rota `web/app/api/v1/autoatendimento/cadastro/nome/route.ts`, `criarRota` + `autenticarTicket`:

1. `identificarCliente(org, telefone)`: `identificado` → `CUSTOMER_CONFLICT` ("Este número já tem
   cadastro."); `ambiguo` → `CUSTOMER_AMBIGUOUS`. Só `desconhecido` segue: é o único caso de uso, e
   restringir reduz a superfície de enumeração.
2. Limite novo `aa-nome`: **10 por hora** por `org:telefone` (em `limites.ts`).
3. `existeClienteComNome(db, org, nome)` em `lib/domain/clientes.ts`:
   - normalização dos dois lados: `NFD` → remove diacríticos → minúsculas → troca qualquer sequência
     de espaço por um → `trim`;
   - **igualdade do nome completo normalizado**, nunca prefixo, `ilike` ou semelhança;
   - lê só `name` de `customers` com `organization_id = org` e `deleted_at is null`, paginando de 1000
     em 1000 até achar ou acabar (não existe coluna normalizada de nome; ver C11);
   - devolve `boolean`. Nunca id, contagem, telefone ou qualquer outro campo.
4. Resposta `{ data: { existe } }`.

Log: `[autoatendimento:cadastro-nome] existe=<bool>` — **sem o nome**.

OpenAPI: `operationId: "verificarNomeCadastrado"`, tag "Cadastro", `x-atendente: true`, descrição:
"Use só quando o contexto disser `desconhecido` e o cliente informar o nome. `existe: true` significa
que já há um cadastro com esse nome **em outro número**: não tente acessá-lo nem cadastrar de novo;
chame a equipe com o motivo `numero_novo`. `existe: false`: siga para `criarCadastro`." Erros:
autenticação, `CUSTOMER_CONFLICT`, `CUSTOMER_AMBIGUOUS`, `RATE_LIMITED`, `VALIDATION_ERROR`.

## 3. Motivos de escalonamento

`EscalonarBody.motivo` (`mensagens.ts`) ganha dois valores, e `ROTULO_DO_MOTIVO`
(`lib/autoatendimento/escalonamento.ts`) os rótulos:

| Valor | Rótulo na mensagem à equipe |
|---|---|
| `numero_novo` | "cliente sem cadastro neste número diz ser alguém já cadastrado — confira e vincule" |
| `falha_tecnica` | "falha técnica no atendimento automático" |

O resto do escalonamento não muda. O `resumo` de `numero_novo` traz o nome que o cliente informou
(o agens monta); o texto à equipe já mostra o telefone do ticket.

## 4. Áudio

### 4.1 Encaminhamento

`conteudo` de `MensagemEncaminhada` (`mensagens.ts`) ganha uma variante:

```ts
z.object({
  tipo: z.literal("audio"),
  /** audioMessage.seconds */
  duracaoS: z.number().int().nonnegative(),
  /** audioMessage.mimetype, ex.: "audio/ogg; codecs=opus" */
  mime: z.string().min(1),
  /** audioMessage.fileLength em bytes; 0 se a Evolution não informou */
  tamanho: z.number().int().nonnegative(),
  /** contextInfo.isForwarded || contextInfo.forwardingScore > 0 */
  encaminhado: z.boolean(),
}),
```

`lib/whatsapp/extrair-mensagem.ts` ganha `extractAudio(message)` que devolve esses quatro campos se
houver `message.audioMessage`, senão `null` (`fileLength` pode vir como string ou objeto Long:
`Number(String(x))`, inválido vira `0`). Em `encaminhar.ts`, a ordem passa a ser: texto → áudio →
`nao_suportado`. Vale também para `deMim` (o agens só pausa; não baixa nada).

**Nenhum byte de áudio passa pelo encaminhamento.** O payload continua pequeno e assinado como hoje.

### 4.2 `GET /api/v1/autoatendimento/mensagens/{mensagemId}/midia`

Rota `web/app/api/v1/autoatendimento/mensagens/[mensagemId]/midia/route.ts`, `criarRota` +
`autenticarTicket`:

1. `autenticarTicket` passa a devolver também `mensagemId` (= `ticket.payload.msg`) em
   `ContextoAutoatendimento`. **Só esta rota usa o campo.**
2. `mensagemId` do caminho ≠ `mensagemId` do ticket → `NOT_FOUND`. O ticket de uma mensagem só abre a
   mídia **daquela** mensagem; não há como pedir mídia de outra conversa ou de outra mensagem.
3. Limite novo `aa-midia`: **30 por hora** por `org:telefone`.
4. `baixarMidia({ organizationId, mensagemId })` — função nova em `lib/whatsapp/gateway.ts` (o único
   ponto que conhece a Evolution, como `enviarTexto`). Na Evolution v2:
   `POST {url}/chat/getBase64FromMediaMessage/{instancia}` com `apikey` e corpo
   `{ "message": { "key": { "id": mensagemId } }, "convertToMp4": false }`; resposta com `base64` e
   `mimetype`. **Verificar no servidor de dev antes de codar a rota** (passo 0 da §7): se a versão
   instalada pedir outro formato (objeto `message` completo, outra rota), adaptar só dentro do
   gateway; se exigir guardar a mensagem no Eliza, parar e registrar.
5. Resultado:
   - Evolution não achou a mensagem (expirou, id desconhecido) → `NOT_FOUND`;
   - outra falha → `WHATSAPP_UNAVAILABLE` (502, já existe), motivo só no log;
   - bytes decodificados > **16 MB** → `MEDIA_TOO_LARGE` (código novo, 413);
   - sucesso → `{ data: { mime, tamanho, base64 } }` (`tamanho` = bytes decodificados).
6. **Nada é gravado**: nem disco, nem banco, nem log com conteúdo. Log só
   `[autoatendimento:midia] ok tamanho=<n>` ou o motivo da falha.

Por que base64 dentro do envelope e não bytes crus: a rota continua sob `criarRota` (erros, request_id
e log iguais aos das outras), e áudio de WhatsApp é pequeno (opus, ~100 KB por minuto).

Zod (`mensagens.ts`):

```ts
export const MidiaResposta = apiSuccess(
  z.object({ mime: z.string(), tamanho: z.number().int().nonnegative(), base64: z.string() })
)
```

Catálogo (`contracts/comum/envelope.ts`): `MEDIA_TOO_LARGE` com status 413.

OpenAPI: `operationId: "baixarMidia"`, tag "Mensagens e escalonamento", **sem** `x-atendente`.
Atualizar o exemplo do webhook `receberMensagem` com um caso de áudio.

## 5. Campo `atendente` no contexto

### 5.1 Colunas novas em `autoatendimento_config`

Migration `supabase/migrations/<timestamp>_autoatendimento_atendente.sql`, aditiva:

```sql
alter table public.autoatendimento_config
  add column atendente_persona text
    check (char_length(atendente_persona) between 1 and 60),
  add column atendente_tom text
    check (char_length(atendente_tom) between 1 and 300),
  add column pausa_humana_horas integer
    check (pausa_humana_horas between 1 and 168),
  add column resposta_confirmado text
    check (char_length(resposta_confirmado) between 1 and 500),
  add column resposta_cancelado text
    check (char_length(resposta_cancelado) between 1 and 500),
  add column resposta_falha_tecnica text
    check (char_length(resposta_falha_tecnica) between 1 and 500),
  add column resposta_midia_nao_suportada text
    check (char_length(resposta_midia_nao_suportada) between 1 and 500),
  add column resposta_audio_longo text
    check (char_length(resposta_audio_longo) between 1 and 500),
  add column resposta_equipe_sem_contato text
    check (char_length(resposta_equipe_sem_contato) between 1 and 500),
  add column palavras_confirmar text[]
    check (cardinality(palavras_confirmar) between 1 and 30),
  add column palavras_cancelar text[]
    check (cardinality(palavras_cancelar) between 1 and 30);
```

Todas anuláveis: `null` = "use o padrão". Grants e RLS não mudam (a tabela já é só leitura da
própria org para `authenticated`; escrita pelo Studio, como na F0). Depois: `supabase gen types`.

### 5.2 Forma no contexto

`contexto.ts`:

```ts
export const Atendente = z.object({
  /** Nome com que o atendente se apresenta; null = não se apresenta por nome. */
  persona: z.string().nullable(),
  /** Tom de voz em texto livre. */
  tom: z.string().nullable(),
  /** Horas de pausa quando a equipe responde pelo celular; null = padrão do atendente. */
  pausaHumanaHoras: z.number().int().positive().nullable(),
  /** Textos fixos. `{primeiroNome}` é substituído pelo atendente. null = padrão do atendente. */
  respostas: z.object({
    confirmado: z.string().nullable(),
    cancelado: z.string().nullable(),
    falhaTecnica: z.string().nullable(),
    midiaNaoSuportada: z.string().nullable(),
    audioLongo: z.string().nullable(),
    equipeSemContato: z.string().nullable(),
  }),
  /** Palavras que, sozinhas, confirmam ou cancelam o único agendamento aguardando confirmação. */
  palavras: z.object({
    confirmar: z.array(z.string()).nullable(),
    cancelar: z.array(z.string()).nullable(),
  }),
})
```

e `Contexto` ganha `atendente: Atendente` (sempre presente; campos nulos quando não há valor).

### 5.3 Combinação (padrão do Eliza + org)

Em `lib/autoatendimento/contexto.ts`, `montarAtendente(config, settings)`. A coluna da org vence; sem
ela, o padrão do Eliza; sem padrão do Eliza, `null` (e o agens aplica o dele).

| Campo | Padrão do Eliza (quando a coluna é nula) |
|---|---|
| `persona`, `tom`, `pausaHumanaHoras`, `falhaTecnica`, `midiaNaoSuportada`, `audioLongo`, `equipeSemContato`, `palavras.*` | `null` |
| `respostas.confirmado` | o texto de `respostaWebhookConfirmacao` com `{primeiroNome}` no lugar do nome: `"✅ *Confirmado, {primeiroNome}!* Já deixei seu agendamento confirmado na agenda. Te aguardamos!"` |
| `respostas.cancelado` | o template da org `organization_settings.msg_appointment_canceled` com `{name}` trocado por `{primeiroNome}`, se existir; senão o padrão de `respostaWebhookCancelamento` com `{primeiroNome}` |

Extrair o texto padrão dessas duas funções para constantes em `lib/domain/mensagens.ts` (as funções
passam a usá-las) — assim o webhook antigo e o contexto nunca divergem.

`carregarConfig` passa a ler as colunas novas e `ConfigAutoatendimento` ganha os campos. Contexto
continua sem `contato_humano_telefone` e sem dado de outro cliente.

## 6. O que não muda

- Ticket, autenticação, envelope, limites existentes, idempotência (C5), fallback do webhook (D5).
- Encaminhamento continua sem retentativa e com timeout de 3 s.
- `instrucoesAtendimento` continua em `politica` (já existe; o agens usa como instruções).
- Escalonamento continua sem tabela.

## 7. Ordem de execução

0. **Verificação da Evolution (antes de qualquer código do item 4):** no servidor de dev, mandar um
   áudio para a instância da org `admin`, pegar o `key.id` no log do webhook e chamar
   `getBase64FromMediaMessage` com `curl`. Registrar no relatório o formato que funcionou.
1. Migration do item 5 → `supabase gen types`.
2. Zod: `envelope.ts` (`MEDIA_TOO_LARGE`), `mensagens.ts` (áudio, motivos, `MidiaResposta`),
   `cadastro.ts` (`VerificarNome*`), `contexto.ts` (`Atendente`).
3. `lib/domain`: `existeClienteComNome`; constantes de `mensagens.ts`.
4. `lib/autoatendimento`: limites (`aa-nome`, `aa-midia`), `autenticar.ts` (`mensagemId`),
   `config.ts`, `contexto.ts` (`montarAtendente`), `escalonamento.ts` (rótulos).
5. `lib/whatsapp`: `extractAudio`, `gateway.baixarMidia`.
6. `encaminhar.ts` (variante áudio).
7. Rotas: `cadastro/nome`, `mensagens/[mensagemId]/midia`.
8. OpenAPI: marcações do item 1, operações novas, exemplos; `docs/API_AUTOATENDIMENTO.md` (guia)
   com as rotas novas e o campo `atendente`.
9. `npx tsc --noEmit`, `npm run lint`, `npm run build` limpos.
10. Aceite (§8) com `curl` e `scripts/ticket-dev.mjs`, registrado em
    `docs/RELATORIO_AUTOATENDIMENTO_F0.md` numa seção "Revisão 07 (sola-agens)".

Deploy: código antes de migration não quebra (colunas lidas com `select("*")` ausentes viram
`undefined` → `null`); migration antes de código também não (colunas novas anuláveis). Seguir o
caminho normal do DEPLOY (PR `development` → `main`, VPS `/opt/eliza`).

## 8. Aceite

**Item 1**
- [ ] `GET /api/v1/autoatendimento/openapi.json`: as 12 operações do item 1 com `x-atendente: true`;
      `obterContexto`, `enviarMensagem`, `escalarParaEquipe`, `baixarMidia` sem.

**Item 2**
- [ ] Desconhecido + nome de cliente existente com acento e caixa diferentes ("maria  silva" vs
      "Maria Silva") → `{ existe: true }`.
- [ ] Desconhecido + só o primeiro nome de um cliente existente ("Maria") → `{ existe: false }`.
- [ ] Desconhecido + nome de cliente de **outra org** → `{ existe: false }`.
- [ ] Desconhecido + nome de cliente apagado (`deleted_at`) → `{ existe: false }`.
- [ ] Identificado → 409 `CUSTOMER_CONFLICT`; ambíguo → 409 `CUSTOMER_AMBIGUOUS`.
- [ ] 11ª chamada na hora → 429 `RATE_LIMITED`.
- [ ] Log do servidor sem o nome pesquisado.

**Item 3**
- [ ] `motivo: "numero_novo"` e `"falha_tecnica"` → 200; a mensagem à equipe traz o rótulo da tabela.
- [ ] Motivo inexistente → 422.

**Item 4**
- [ ] Áudio recebido numa org ativa → encaminhado com `conteudo.tipo = "audio"`, `duracaoS`, `mime`,
      `tamanho`; áudio encaminhado de outra conversa → `encaminhado: true`.
- [ ] Texto e `nao_suportado` continuam iguais (imagem ainda é `nao_suportado`).
- [ ] `GET /mensagens/{id}/midia` com o ticket **daquele** áudio → 200, `base64` decodifica num arquivo
      que toca.
- [ ] Mesmo ticket, `mensagemId` de outra mensagem → 404.
- [ ] Ticket de texto pedindo a mídia do áudio anterior → 404.
- [ ] Nenhum arquivo novo no disco do servidor; log sem conteúdo.

**Item 5**
- [ ] Org sem colunas preenchidas → `atendente` com tudo `null`, exceto `respostas.confirmado` e
      `respostas.cancelado` (padrões do Eliza, com `{primeiroNome}`).
- [ ] Org com `msg_appointment_canceled` próprio → `respostas.cancelado` é esse template com
      `{primeiroNome}`.
- [ ] `atendente_persona = 'Lia'`, `pausa_humana_horas = 1`, `palavras_confirmar = '{sim,fechado}'` →
      aparecem no contexto.
- [ ] `pausa_humana_horas = 0` ou `atendente_persona` com 61 caracteres → migration/insert recusa
      (CHECK).
- [ ] Webhook antigo ("sim" com o atendente fora) responde o mesmo texto de antes.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| C8 | **Revisão aditiva, versão continua `1`** | Subir `CONTRATO_VERSAO` para 2 | Tudo é acréscimo (campos, operações, variante de `conteudo`); o único consumidor é o sola-agens, construído já com esta revisão. Subir a versão obrigaria troca coordenada de header sem ganho |
| C9 | **Busca por nome devolve só `existe`, só para `desconhecido`, nome completo exato** | Devolver o cadastro achado; busca aproximada | Quem diz o nome de outra pessoa não pode ganhar acesso nem confirmação de dado (B3 do sola-agens). Busca aproximada aumentaria falso positivo e enumeração |
| C10 | **Mídia só da mensagem do próprio ticket, em base64 no envelope** | Atendente com a chave da Evolution; URL assinada para a mídia | Mantém C3 (a chave global da Evolution fica só no Eliza) e o ticket continua sendo o limite do que o atendente alcança |
| C11 | **Nome comparado em TypeScript, lendo `name` paginado** | Coluna `name_normalized` + índice | Volume por org é pequeno (centenas a poucos milhares de clientes) e `unaccent` não é `immutable` (coluna gerada exige função wrapper). Revisitar quando uma org passar de ~10 mil clientes |
| C12 | **Personalização do atendente em colunas tipadas** (texto e `text[]` com CHECK) | Uma coluna `jsonb` com respostas e palavras | Mesmo motivo da C6: tipo e CHECK no banco, sai inteira com o `drop` do add-on |
| C13 | **O Eliza entrega a configuração já combinada** (padrão do Eliza + org) no contexto | O atendente busca a config separada e combina | O sistema é dono da configuração dele (A4 do sola-agens); uma chamada por turno a menos |

## 10. Fora deste contrato

- Tela no painel para editar persona, tom, respostas e palavras (continua pelo Studio).
- Imagem, documento e vídeo: continuam `nao_suportado` no encaminhamento.
- Comando para retomar o atendente antes do fim da pausa.
- Tabela de escalonamentos e fila no painel.
- Módulo de treinamento do sola-agens (rascunho no `sola-agens/CONTRATO.md §11`).
