# Atendente Eliza (chatbot WhatsApp)

> **Status:** F0 (API de Autoatendimento no Eliza) **implementada e na `main`** em 2026-10-06. Falta o consumidor (`eliza-atendente`).
> **Última revisão:** 2026-10-09 — decisões E1–E6 da [análise de custo × benefício](ANALISE_ATENDENTE.md); D3 substituída por E1.
> **O bot deixou de ser do Eliza:** virou a plataforma interna **`sola-agens`** (`Projetos/SolaSoftware/sola-agens`, decisões em `docs/DECISOES.md` de lá). O Eliza é o primeiro agente (F1), no modo de identidade *encaminhado*. O que está abaixo sobre o lado do Eliza continua valendo.
> **Tipo:** TO-BE (descreve o alvo; o código atual ainda não está em conformidade)

## Objetivo

Add-on pago por organização: atendimento 24h pelo WhatsApp do tenant, em que o
**cliente final** consulta serviços e horários, marca, remarca, cancela e
confirma os **próprios** agendamentos e mantém o **próprio** cadastro.

Não é um bot para a equipe interna. Permissão de equipe é outro escopo (ver
"Fora do escopo").

## Diagnóstico do terreno (AS-IS, 2026-09-23)

O que já sustenta a feature:

- **Anti-overbooking no banco.** `appointments_professional_overlap_idx`
  (exclusion constraint GiST sobre `tstzrange(start_time, end_time)` por
  profissional, status ativos). Bot e recepção marcando no mesmo segundo não
  geram conflito; o perdedor recebe `23P01`.
- **Identificação exata do cliente.** `customers.phone_normalized` com índice
  único `uq_customers_org_phone (organization_id, phone_normalized)`.
- **Roteamento por tenant.** Servidor Evolution único (`web/lib/evolution.ts`),
  instância por org em `organizations.whatsapp_instance_name`.
- **Auditoria.** `appointment_logs.source` — basta gravar `source = 'chatbot'`.

O que falta ou atrapalha:

1. **Não existe API.** A regra de negócio vive em server actions acopladas a
   `FormData`, `revalidatePath` e envio de WhatsApp (`create-appointment.ts`,
   `get-available-slots.ts`, `lib/appointment-config.ts`). Um serviço externo
   não consegue chamá-las de forma estável, e reimplementar o cálculo de
   horários no bot faria as duas versões divergirem.
2. **Conflito de webhook.** `api/webhooks/whatsapp` classifica por
   palavra-chave e cancela o próximo agendamento se a mensagem contém "não",
   "remarcar" etc. Em conversa livre isso cancela sozinho. Bot e fluxo de
   palavra-chave não podem ouvir o mesmo número ao mesmo tempo.
3. **Notificação duplicada.** `createAppointment` sempre envia "seu agendamento
   foi marcado"; somado à resposta do bot, o cliente recebe duas mensagens.
4. **Sem flag de add-on por org.** Não há gating de plano em lugar nenhum.
5. **Falhas de segurança no caminho** (tratadas em sessão separada,
   2026-09-23): webhook sem autenticação com match de cliente pelos 4 últimos
   dígitos, e `createAppointment` sem checagem de sessão. A F0 pressupõe que
   estejam fechadas.

## Arquitetura

```txt
Evolution API ──webhook──▶ Eliza /api/webhooks/whatsapp
                              │ acha org pela instância
                              │ add-on ativo?
                   ┌──────────┴──────────┐
                  não                   sim
                   │                     │
        fluxo palavra-chave      repassa ──▶ sola-agens, agente Eliza (Go, E1)
          (comportamento atual)              │ dedupe por message.id
                                             │ debounce ~3s por conversa
                                             │ lock: 1 conversa por vez
                                             │ LLM + ferramentas
                                             ▼
                              Eliza /api/v1/autoatendimento/*  (token + ticket)
                                             │
                                        lib/domain/*  ◀── server actions atuais
                                             │
                                          Supabase
                                             ▲
                         schema `atendente` ─┘ (histórico, estado da conversa)

eliza-atendente ──resposta──▶ Eliza POST /mensagens ──▶ gateway ──▶ Evolution API
```

### Peças no Eliza

| Peça | Função |
|---|---|
| `web/lib/domain/` (`slots`, `appointments`, `customers`) | Regra extraída das server actions. Funções tipadas com `orgId` explícito, sem `FormData` nem `revalidatePath`. Server actions e API passam a chamá-las. |
| `web/lib/whatsapp/gateway.ts` | Único ponto que conhece a Evolution: enviar texto/mídia, conectar, status, normalizar payload de webhook. Isola uma eventual troca de gateway. |
| `web/app/api/v1/autoatendimento/*` | Route handlers autenticados por token de serviço + ticket de conversa; org e telefone saem do ticket. |
| Config do add-on por org | Liga/desliga, tom, status de nascimento do agendamento, contato para escalar a humano. Tabela `autoatendimento_config` (proposta C6 do contrato). |
| Flag `notify` no create de agendamento | Permite ao bot suprimir a notificação automática. |

### Peças no `eliza-atendente`

| Peça | Função |
|---|---|
| Receptor | Responde 200 imediatamente e enfileira. |
| Dedupe | Descarta retentativas pelo `message.id`. |
| Debounce + lock | Agrupa rajadas ("oi" / "queria marcar" / "amanhã") e processa uma conversa por vez. |
| Agente | LLM com tool use; cada ferramenta mapeia 1:1 para um endpoint da API v1. |
| Estado | Histórico, pausa por intervenção humana, contexto da conversa — schema `atendente`. |

### Ferramentas previstas

`listar_servicos`, `listar_profissionais`, `horarios_livres`,
`meus_agendamentos`, `agendar`, `remarcar`, `cancelar`, `confirmar`,
`meu_cadastro`, `atualizar_cadastro`, `chamar_humano`.

## Decisões tomadas

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D1 | **Evolution API** (Node/Baileys), a mesma já em produção | Evolution Go | Go está em 0.x, exige ativação de licença com heartbeat ao servidor do fornecedor (API retorna 503 sem licença) e o ganho de desempenho não aparece no volume do Eliza — o gargalo do bot é o LLM. A troca fica barata via `lib/whatsapp/gateway.ts`. Custo aceito: re-parear números fica mais caro conforme entram tenants. Reabrir se RAM da VPS passar de ~70% com instâncias conectadas, se quedas de sessão do Baileys virarem recorrentes ou se a Evolution API ficar sem release estável. |
| D2 | **Serviço separado** (`eliza-atendente`) falando com o Eliza por API | Bot dentro do Next.js | Fronteira clara: o bot não toca o banco de domínio diretamente; a regra de negócio continua num lugar só. |
| ~~D3~~ | ~~**Node + TypeScript** no bot~~ — **substituída por E1 em 2026-10-09** | Go | O motivo (compartilhar os Zod) perdeu força: a OpenAPI gerada dos mesmos Zod dá um cliente Go tipado, e o Smaug já tem o motor de agente em Go. |
| D4 | **Histórico no schema `atendente`**, mesmo banco Supabase, acessado só pelo bot | Banco próprio do bot | Mesmo backup e uma superfície LGPD só. Custo aceito: independência de código, não de infraestrutura. |
| D5 | **Webhook continua entrando pelo Eliza**, que repassa ao bot | Evolution apontando direto para o bot | Gating do add-on num lugar só, fallback para o fluxo de palavra-chave se o bot cair, e a config de webhook da Evolution não muda ao ligar o add-on. Custo aceito: um salto a mais, e o Eliza no caminho (o bot já depende dele para as ferramentas). |
| D6 | **Org e telefone nunca vêm do LLM.** Ambos saem do webhook e são injetados pela camada de ferramentas do bot; a API valida o escopo. | Deixar o modelo passar identificadores | Evita injeção de prompt virar acesso a dado de terceiro ("cancela o horário da Maria"). Em clínica/psicologia é dado de saúde. |
| D7 | **"Excluir" pelo bot = cancelar.** Nenhum hard delete de agendamento ou cliente. | CRUD completo | Reversibilidade; o Eliza já tem `status = 'canceled'` e `deleted_at`. |
| D8 | **Bot não acessa prontuário** (`service_records`), nem leitura. | — | Minimiza dado sensível enviado ao provedor de LLM. |
| D9 | **Intervenção humana pausa o bot.** Mensagem `fromMe` que o bot não enviou pausa aquela conversa por algumas horas. | Bot sempre ativo | O dono vai responder pelo próprio celular; sem isso os dois falam ao mesmo tempo. |
| D10 | **Contexto injetado a cada turno:** data/hora atual em `America/Sao_Paulo` e agendamentos aguardando confirmação. | Depender só do histórico do bot | O lembrete sai do cron do Eliza, não do bot; sem isso um "sim" em resposta ao lembrete fica ambíguo. |

## Decisões de 2026-10-09 (análise de custo × benefício)

Detalhe, alternativas e trade-offs em [ANALISE_ATENDENTE.md](ANALISE_ATENDENTE.md).

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| E1 | **Bot em Go**, extraindo o motor de agente do Smaug (`redmilab/servicos/smaug`). Cliente da API gerado da OpenAPI (`/api/v1/autoatendimento/openapi.json`). Substitui D3. | Node/TS escrito do zero | Reaproveita LLM, ferramentas, fastpath, fila, áudio e imagem já em produção; ~20–40 MB de RAM. O bot não fala com a Evolution (D5/C3), então a linguagem dela não pesa. Custo aceito: mudança de contrato exige regenerar o cliente; o CI do bot acusa. |
| E2 | **Motor genérico em `sola-agens`** (P1–P6 de lá): plataforma interna da Sola que lê a OpenAPI de cada sistema; o Eliza é o agente da F1. Ordem dos agentes: Eliza → Site → Axios Calc → SolaBridge. Uma instância na VPS da Sola para todos os agentes da Sola; outra empresa teria instância própria. | Bot exclusivo do Eliza; produto comercial de chatbot | Sistemas da Sola com stacks diferentes (Next, Laravel, site estático) vão querer atendente; o objetivo é replicar, não vender. |
| E3 | **LLM de terceiro com tool use**: Gemini 2.5 Flash-Lite em **plano pago** como padrão, escada para modelo maior só se a avaliação mostrar erro de ferramenta, raciocínio desligado. **Fastpath determinístico** na frente ("sim", "confirmo", "cancelar"). Bateria fixa de ~40 conversas antes de tenant real e a cada troca de modelo/prompt. | Mini-modelo local; NLP clássico como motor | VPS sem GPU (5–20 s por resposta) e modelos pequenos erram tool use em PT-BR; NLP clássico é o fluxo de palavra-chave, que quebra em conversa livre. Plano gratuito do Gemini pode usar o conteúdo — inaceitável com dado de saúde. |
| E4 | **Histórico no schema `atendente`** do Supabase do Eliza, papel de banco que só enxerga esse schema (mantém D4). Dado vivo sempre pela API, sem cópia; conhecimento estático do tenant no Eliza (`instrucoes_atendimento`, depois tabela de FAQ via `/contexto`). Sem RAG na F1. | Acesso ao banco do Eliza; base paralela com cópia de agenda | D9 fechou a escrita fora do domínio de propósito; cópia de agenda desatualiza. |
| E5 | **Retenção (fecha A5):** 90 dias de texto completo, depois só metadados; apagamento sob pedido do titular. Auditoria do bot por turno (ferramentas, argumentos, modelo, tokens, custo), além do `appointment_logs` do Eliza. | Guardar tudo indefinidamente | LGPD; o log por turno responde "por que o bot fez isso" e "quanto custou o tenant". |
| E6 | ~~Verificar qual Evolution o Eliza usa~~ **Resolvida em 2026-10-09:** Evolution padrão (Node), na **VPS da Sola**, sem relação com a Geti. | — | — |

## Decisões em aberto

| # | Questão | Recomendação | Trade-off | Dono / prazo |
|---|---|---|---|---|
| ~~A1~~ | **Fechada em 2026-10-06 (D8):** nasce `pending` ("solicitado"), sempre, igual à página pública; o tenant confirma. Não configurável. | — | — | — |
| ~~A2~~ | **Fechada em 2026-10-06:** C6 confirmada, tabela própria `autoatendimento_config`. | — | — | — |
| ~~A3~~ | **Fechada em 2026-10-06:** C7 confirmada, token de serviço único + ticket. O token do bot não é uma API key da v1. | — | — | — |
| A4 | Modelo de LLM e custo por tenant | **Encaminhada por E3:** Gemini 2.5 Flash-Lite pago (~US$ 0,006/conversa estimado). Medir o real na F1 antes de fechar o preço do add-on | — | F1 |
| ~~A5~~ | **Fechada em 2026-10-09 (E5):** 90 dias de texto completo, depois só metadados sem texto; apagamento sob pedido do titular. | — | — | — |

Decisões de 2026-10-06 em `docs/contratos/DECISOES_API.md`.

## Fases

| Fase | Entrega | Depende de |
|---|---|---|
| **F0 — Terreno** (só Eliza) | `lib/domain/`, `lib/whatsapp/gateway.ts`, API v1 com token, flag `notify`, config do add-on, repasse do webhook para o bot | Falhas de segurança fechadas |
| **F1 — Leitura** | Serviços, profissionais, horários livres, meus agendamentos, chamar humano | F0, A5 |
| **F2 — Escrita na agenda** | Agendar, remarcar, cancelar, confirmar. Fluxo de palavra-chave vira só fallback. | F1, A1 |
| **F3 — Cadastro** | Criar e atualizar o próprio cadastro | F2 |

## Fora do escopo agora

- Migração para Evolution Go (ver D1 para gatilhos de reabertura)
- Painel de conversas no Eliza
- Áudio, imagem e documentos recebidos
- Bot para a equipe interna (outro modelo de permissão)
- Gating por plano além do liga/desliga do add-on

## Pendências de compliance

- **Aviso de uso da Evolution API.** A licença exige notificação visível a
  administradores de que o sistema usa a Evolution API. Não existe hoje em
  lugar nenhum do Eliza. Uma linha em Configurações → WhatsApp resolve.
- **LGPD / provedor de LLM.** Conversas podem conter dado de saúde. Revisar
  termos do provedor e política de privacidade do tenant antes do go-live.

## Contratos

F0 contratada em [docs/contratos/autoatendimento/](contratos/autoatendimento/README.md)
(2026-09-23). Zod em `web/contracts/autoatendimento/`. A API se chama
**Autoatendimento** e é neutra de canal: o Eliza não sabe que do outro lado
há um LLM. O contrato acrescenta duas decisões a esta página: o **ticket de
conversa** assinado pelo Eliza (org e telefone saem dele, nunca do atendente)
e o **envio de WhatsApp pelo Eliza** (o atendente não recebe a key da
Evolution).

## Próximos passos

1. ~~Decidir A1 e confirmar A2/A3~~ (feito em 2026-10-06).
2. ~~Commitar as correções de segurança de 2026-09-23~~ (feito).
3. ~~Executar a ordem de `docs/contratos/README.md`: 00-dominio → api-v1 → F0 do Autoatendimento~~ (feito, PRs #39–#41).
4. ~~Verificar a Evolution de produção do Eliza (E6)~~ (VPS da Sola).
5. F1 do `sola-agens`: levantamento do motor do Smaug, contrato do motor + conector OpenAPI + modo encaminhado, agente Eliza; bateria de avaliação (E3); schema `atendente` com retenção (E4/E5).
