# 09 — Avisos do sistema no encaminhamento

> TO-BE · Contrato v1, **revisão aditiva** (o header de versão continua `1`, ver C27) · ver [README](README.md)
> **Escrito em:** 2026-10-26 · **Origem:** primeiro teste do sola-agens em produção (Clínica Admin) e
> decisão A11 do `sola-agens/CONTRATO.md §10`
> **Zod tocados:** `mensagens.ts` · **Migration nova:** `autoatendimento_envios_sistema`

## Para quem executa

Mesmas regras do [README](README.md#para-quem-executa): os `.md` dizem **o que** e **por quê**; os Zod
são a forma exata. Onde este arquivo der um valor fechado, use o valor. Se o código contradisser uma
premissa daqui, o código vence: pare, registre e siga o que é correto.

Este contrato tem duas metades: o que muda no Eliza (§2–§6) e o que muda no sola-agens (§7). As duas
podem ir ao ar em qualquer ordem (§8).

## 1. O problema

O atendente e a equipe usam **o mesmo número** de WhatsApp da organização. Toda mensagem que sai
desse número volta pelo webhook como `fromMe` e o Eliza a encaminha com `deMim: true` (06). O agens
separa assim:

- id igual a uma resposta que ele mesmo enviou → eco, ignora;
- qualquer outro → **a equipe assumiu**: pausa a conversa por `pausaHumanaHoras` (padrão 12 h).

Só que o Eliza também envia mensagens automáticas por esse número (lembrete do cron, notificações de
agendamento, resposta do fluxo antigo de palavra-chave). Elas não são eco do agens, então hoje
**pausam o atendente como se fossem a equipe**. O caso que quebra o produto:

1. O cron manda o lembrete (template da org, ou "⏰ Lembrete: <serviço> às <hora>") → o agens pausa a conversa.
2. O cliente responde "sim" → a conversa está pausada: o agens não responde nem pelo fastpath (S6).
3. O webhook entregou a mensagem ao agens (202), então o fluxo antigo de palavra-chave também não roda.
4. O "sim" se perde.

**A correção:** o Eliza continua dono dos lembretes e das notificações (C22). Ele **marca** as
mensagens automáticas que envia, e quando o eco delas volta pelo webhook, encaminha ao agens como
**aviso do sistema**: o agens guarda o texto na memória da conversa (para o cliente que responder ao
lembrete ter contexto), **sem pausar** e sem responder.

## 2. Tabela `autoatendimento_envios_sistema`

Migration `supabase/migrations/<timestamp>_autoatendimento_envios_sistema.sql`, aditiva:

```sql
create table public.autoatendimento_envios_sistema (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  tipo text not null check (tipo in (
    'lembrete', 'resumo_profissional', 'notificacao', 'resposta_automatica', 'escalonamento'
  )),
  texto_hash text not null check (char_length(texto_hash) = 64),
  created_at timestamptz not null default now()
);

create index autoatendimento_envios_sistema_busca
  on public.autoatendimento_envios_sistema (organization_id, texto_hash, created_at desc);

alter table public.autoatendimento_envios_sistema enable row level security;
revoke all on public.autoatendimento_envios_sistema from public, anon, authenticated;
grant all on public.autoatendimento_envios_sistema to service_role;
```

Sem policy: só o servidor (service role) lê e escreve. Nenhum texto é guardado, só o hash (o conteúdo
continua só no WhatsApp e, se o add-on estiver ativo, na memória do agens). Depois: `supabase gen types`.

## 3. Registrar o envio (antes de chamar a Evolution)

Função nova em `web/lib/autoatendimento/envios-sistema.ts`:

```ts
export type TipoAviso = "lembrete" | "resumo_profissional" | "notificacao" | "resposta_automatica" | "escalonamento"

/** hex(sha256(texto normalizado)); normalização: \r\n → \n, depois trim. */
export function hashDoTexto(texto: string): string

/**
 * Chamada ANTES do envio. Grava só se ATENDENTE_URL estiver configurada e a org tiver o add-on ativo
 * (carregarConfig); senão não faz nada. Nunca lança: falha vira log e o envio segue (o pior caso é
 * o comportamento de hoje, a pausa).
 */
export async function registrarEnvioSistema(p: { organizationId: string; tipo: TipoAviso; texto: string }): Promise<void>

/** Usada pelo encaminhamento: o texto bate com um registro da org nos últimos 10 minutos? */
export async function tipoDoEnvioSistema(db: Db, organizationId: string, texto: string): Promise<TipoAviso | null>
```

Na mesma chamada de `registrarEnvioSistema`, apagar os registros **da org** com mais de 24 h
(limpeza oportunista; a tabela de uma org nunca passa de um dia de envios).

**Por que antes do envio e por conteúdo, não pelo `key.id` depois:** o id só existe depois que a
Evolution responde, e o webhook do eco pode chegar antes dessa resposta (o `sendText` dos lembretes
usa `delay: 1200`). Registrar antes elimina a corrida. Dois envios automáticos com o mesmo texto na
mesma org dentro de 10 minutos casam com o mesmo registro, e está certo: os dois são do sistema. Uma
pessoa da equipe digitando **exatamente** o mesmo texto nessa janela também vira aviso (não pausa);
é raro e o efeito é só deixar de pausar (C23).

### 3.1 Onde chamar

`sendWhatsAppMessage` (`app/actions/send-whatsapp.ts`) ganha o parâmetro opcional
`registrarComo?: TipoAviso`. Com ele, chama `registrarEnvioSistema` com o **mesmo** `message` que vai
no corpo, antes do `fetch`. `enviarTexto` (`lib/whatsapp/gateway.ts`) repassa o mesmo parâmetro.

| Envio | Arquivo | `registrarComo` |
|---|---|---|
| Lembrete ao cliente | `api/cron/reminders.ts` → `processPatientMorningReminders` | `lembrete` |
| Resumo diário ao profissional | `api/cron/reminders.ts` → `processDoctorDailySummaries` | `resumo_profissional` |
| Notificação de criação/cancelamento/status | `lib/domain/agendamentos.ts` → `notificar` | `notificacao` |
| Botões "enviar confirmação/cancelamento" do painel | `app/actions/whatsapp-messages.ts` | `notificacao` |
| Resposta do fluxo antigo de palavra-chave | `api/webhooks/whatsapp/[[...slug]]/route.ts` | `resposta_automatica` |
| Aviso à equipe | `lib/autoatendimento/escalonamento.ts` | `escalonamento` |
| **Resposta do atendente** | `lib/autoatendimento/mensagens.ts` | **nenhum** (o agens reconhece o próprio eco pelo id) |

`whatsapp-messages.ts` tem um `fetch` próprio para a Evolution. Trocar por `sendWhatsAppMessage` com
`registrarComo`. Se houver motivo para não trocar (o `number` sem `normalizePhone`, por exemplo),
chamar `registrarEnvioSistema` antes do `fetch` com o mesmo `text` e registrar o motivo.

Fora: PDF do prontuário (`send-record-whatsapp.ts`, mídia) e a demo (`send-demo-whatsapp.ts`, outra
instância). O PDF é gesto da equipe com o cliente; pausar o atendente nele é aceitável (C25).

## 4. Encaminhamento (`lib/autoatendimento/encaminhar.ts`)

Em `enviarAoAtendente`, quando `deMim` e o conteúdo é **texto**: `tipoDoEnvioSistema(db, org.id, texto)`.

- Achou → o payload leva `aviso: { tipo }`.
- Não achou, ou `deMim` com áudio ou `nao_suportado` → `aviso: null` (equipe, como hoje).
- Mensagem do cliente (`deMim: false`) → sempre `aviso: null`.

Erro na consulta → `aviso: null` e log `[autoatendimento:encaminhar] aviso_indisponivel`: na dúvida,
trata como equipe (o comportamento de hoje). Nada mais no encaminhamento muda (timeout, assinatura,
fallback D5).

## 5. Zod (`contracts/autoatendimento/mensagens.ts`)

`MensagemEncaminhada` ganha:

```ts
  /**
   * Só com deMim: a mensagem é um envio automático do próprio sistema (lembrete, notificação...),
   * não a equipe respondendo. O atendente guarda o texto como contexto, NÃO pausa e não responde.
   * null = mensagem do cliente, eco do atendente ou equipe.
   */
  aviso: z.object({
    tipo: z.enum(["lembrete", "resumo_profissional", "notificacao", "resposta_automatica", "escalonamento"]),
  }).nullable(),
```

Refinamento: `aviso !== null` exige `deMim === true`.

OpenAPI: a descrição do webhook `receberMensagem` (a rota que o atendente expõe) ganha o campo e um
exemplo de lembrete com `aviso: { tipo: "lembrete" }`. `docs/API_AUTOATENDIMENTO.md` explica o campo
na seção do encaminhamento.

## 6. O que não muda no Eliza

- Os lembretes e as notificações continuam saindo do Eliza, com os mesmos textos e horários.
- Org sem o add-on: nenhuma linha é gravada, nenhum comportamento muda.
- Fluxo antigo de palavra-chave (D5) com o atendente fora do ar.
- O atendente continua sem nenhum caminho para **iniciar** conversa: o aviso só chega como eco de algo
  que o Eliza já enviou, e não traz ticket.

## 7. Lado do sola-agens

1. **Entrada** (`internal/entrada/encaminhado.go`): campo `aviso *struct{ Tipo string }`. `aviso` com
   `deMim: false` → 400 (contrato quebrado do lado do sistema). Tipo desconhecido é aceito como aviso
   (o enum pode crescer sem quebrar o agens).
2. **F3** (`internal/agent/demim.go`), nesta ordem:
   1. eco do próprio agens → ignora (como hoje);
   2. `aviso != nil` → anexa o texto à memória com o papel novo `aviso`, **sem pausar** e sem turno;
      log `aviso tipo=<tipo>`;
   3. senão → pausa (como hoje).

   O aviso entra na **mesma fila da conversa** que o `deMim` já usa (nunca em paralelo).
3. **Store:** papel `aviso` em `store.go` e migration `0002` no SQLite. O CHECK de `papel` só se muda
   recriando a tabela: `CREATE TABLE` nova → `INSERT ... SELECT` → `DROP` → `RENAME`, SQL portável
   (B1). `storetest` cobre o papel novo.
4. **Memória no prompt** (`run.go`, montagem do histórico): `aviso` vira turno `user` com o prefixo
   `[aviso automático enviado pelo estabelecimento] `.
5. **Prompt** (`COMO AGIR`): uma linha — "Mensagens com [aviso automático enviado pelo estabelecimento]
   são lembretes e avisos que o sistema já mandou ao cliente; a mensagem seguinte do cliente pode ser a
   resposta a eles. Não as repita." Regravar os goldens.
6. **Avaliação:** um cenário novo em `avaliacao/cenarios.yaml`: histórico com aviso de lembrete do
   agendamento de amanhã + cliente "dá pra passar pra sexta?" → `remarcarAgendamento` do agendamento
   certo, sem perguntar qual.
7. **CHECKLIST-ACEITE:** itens novos da §9.

Retenção: o aviso segue a mesma regra das outras mensagens (90 dias de texto).

## 8. Ordem de execução e deploy

0. **Verificação (antes de codar, na produção já em teste):** depois de uma resposta do bot, o log do
   agens deve mostrar `eco` — isso prova que o `sendText` da API volta pelo webhook como
   `messages.upsert` `fromMe`. Depois, disparar um lembrete de teste e conferir no log do Eliza que o
   texto do eco é **igual** ao enviado (emoji, `*negrito*`, quebras de linha). Se o texto vier
   diferente, ajustar só a normalização de `hashDoTexto` e registrar; se o eco não chegar, parar e
   registrar (o problema da §1 não existiria).
1. Eliza: migration → `supabase gen types` → `envios-sistema.ts` → `send-whatsapp.ts`/`gateway.ts` →
   chamadas da §3.1 → `encaminhar.ts` → Zod → OpenAPI e docs → `tsc`, `lint`, `build`.
2. sola-agens: store (migration `0002`, `storetest`) → entrada → `demim.go` → histórico e prompt
   (goldens) → avaliação → `go test ./...`, `go run ./avaliacao`.

**Qualquer ordem de deploy funciona:** o agens ignora campos desconhecidos (`encoding/json`), então com
o Eliza novo e o agens velho o aviso pausa como hoje; com o agens novo e o Eliza velho o campo nunca
chega. Migration antes do código também não quebra (tabela nova). Caminho normal do DEPLOY (PR
`development` → `main`).

## 9. Aceite

**Eliza**
- [ ] Org com o add-on: o lembrete grava uma linha (`tipo = lembrete`) antes do envio; o eco chega ao
      agens com `aviso: { tipo: "lembrete" }`.
- [ ] Org **sem** o add-on, ou `ATENDENTE_URL` vazia: lembrete enviado, nenhuma linha gravada.
- [ ] Equipe responde pelo celular: `aviso: null` (pausa como hoje).
- [ ] Resposta do atendente: nenhuma linha gravada; eco com `aviso: null` (o agens reconhece pelo id).
- [ ] Mensagem do cliente: `aviso: null`.
- [ ] Falha de banco no registro: o lembrete sai mesmo assim, com log.
- [ ] Linha com mais de 24 h some no registro seguinte da mesma org.
- [ ] `authenticated` e `anon` não leem nem escrevem a tabela.

**sola-agens**
- [ ] Lembrete do Eliza → log `aviso tipo=lembrete`; a conversa **não** pausa.
- [ ] Logo depois, cliente responde "sim" → confirma (fastpath) normalmente.
- [ ] Cliente responde ao lembrete pedindo outro horário → o agens sabe de qual agendamento se trata.
- [ ] Equipe responde pelo celular → continua pausando (item 16 do CHECKLIST).
- [ ] `aviso` com `deMim: false` → 400.

## 10. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| C22 | **O Eliza continua dono dos lembretes e notificações**; o agens só recebe o eco como contexto | O agens assumir lembretes e confirmações | O agens só age sobre quem escreveu nos últimos 30 min (ticket); iniciar conversa exigiria outro modo de autenticação. Orgs sem o add-on continuam precisando do cron, e com o agens fora o lembrete continua saindo (D5) |
| C23 | **Pré-registro antes do envio, casado por org + hash do texto, janela de 10 min** | Registrar o `key.id` depois do envio; usar o campo `source` da Evolution | O id chega depois e o eco pode chegar antes (corrida). `source` é deduzido do formato do id e não separa envio pela API de alguém usando o WhatsApp Web, que é como a recepção trabalha |
| C24 | **Aviso pelo mesmo encaminhamento** (eco `fromMe` com `aviso`), não por chamada nova do Eliza ao agens | `POST` ao agens em cada envio automático | Mantém um único canal Eliza→agens, já assinado; o texto do aviso é o que o cliente de fato recebeu; não cria segunda corrida (aviso × eco) do lado do agens |
| C25 | **Registro só com o add-on ativo**; PDF do prontuário e demo ficam fora | Registrar sempre; incluir mídia | Org sem add-on não acumula linha nenhuma e o `drop` do add-on leva a tabela junto. Mídia não tem texto para casar, e o PDF é gesto da equipe |
| C26 | **Só o hash do texto é guardado** | Guardar o texto | O Eliza não precisa do conteúdo para casar; menos dado pessoal parado no banco |
| C27 | **Revisão aditiva, versão continua `1`** | Subir `CONTRATO_VERSAO` | Campo novo e anulável; o agens ignora campos desconhecidos, então o deploy é em qualquer ordem |

## 11. Fora deste contrato

- Tela para ver ou apagar os registros (é tabela técnica de vida curta).
- Avisos de mídia (PDF, imagem).
- O agens responder sozinho a um aviso (ele nunca inicia conversa).
- Comando para retomar o atendente antes do fim da pausa (continua fora, como em 07).
