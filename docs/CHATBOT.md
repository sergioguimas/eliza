# Atendente Eliza (chatbot WhatsApp)

> **Status:** planejamento — nenhum código escrito. Documento de decisões e escopo.
> **Última revisão:** 2026-09-23
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
        fluxo palavra-chave      repassa ──▶ eliza-atendente (serviço Node/TS)
          (comportamento atual)              │ dedupe por message.id
                                             │ debounce ~3s por conversa
                                             │ lock: 1 conversa por vez
                                             │ LLM + ferramentas
                                             ▼
                                   Eliza /api/v1/atendente/*  (token de serviço)
                                             │
                                        lib/domain/*  ◀── server actions atuais
                                             │
                                          Supabase
                                             ▲
                         schema `atendente` ─┘ (histórico, estado da conversa)

eliza-atendente ──resposta──▶ Evolution API (via adaptador de gateway)
```

### Peças no Eliza

| Peça | Função |
|---|---|
| `web/lib/domain/` (`slots`, `appointments`, `customers`) | Regra extraída das server actions. Funções tipadas com `orgId` explícito, sem `FormData` nem `revalidatePath`. Server actions e API passam a chamá-las. |
| `web/lib/whatsapp/gateway.ts` | Único ponto que conhece a Evolution: enviar texto/mídia, conectar, status, normalizar payload de webhook. Isola uma eventual troca de gateway. |
| `web/app/api/v1/atendente/*` | Route handlers autenticados por token de serviço, escopados por (org, telefone do cliente). |
| Config do add-on por org | Liga/desliga, tom, status de nascimento do agendamento, contato para escalar a humano. Tabela `org_addons` ou colunas em `organization_settings` (decidir no contrato). |
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
| D3 | **Node + TypeScript** no bot | Go | Compartilha contratos Zod e tipos gerados do Supabase com o Eliza. |
| D4 | **Histórico no schema `atendente`**, mesmo banco Supabase, acessado só pelo bot | Banco próprio do bot | Mesmo backup e uma superfície LGPD só. Custo aceito: independência de código, não de infraestrutura. |
| D5 | **Webhook continua entrando pelo Eliza**, que repassa ao bot | Evolution apontando direto para o bot | Gating do add-on num lugar só, fallback para o fluxo de palavra-chave se o bot cair, e a config de webhook da Evolution não muda ao ligar o add-on. Custo aceito: um salto a mais, e o Eliza no caminho (o bot já depende dele para as ferramentas). |
| D6 | **Org e telefone nunca vêm do LLM.** Ambos saem do webhook e são injetados pela camada de ferramentas do bot; a API valida o escopo. | Deixar o modelo passar identificadores | Evita injeção de prompt virar acesso a dado de terceiro ("cancela o horário da Maria"). Em clínica/psicologia é dado de saúde. |
| D7 | **"Excluir" pelo bot = cancelar.** Nenhum hard delete de agendamento ou cliente. | CRUD completo | Reversibilidade; o Eliza já tem `status = 'canceled'` e `deleted_at`. |
| D8 | **Bot não acessa prontuário** (`service_records`), nem leitura. | — | Minimiza dado sensível enviado ao provedor de LLM. |
| D9 | **Intervenção humana pausa o bot.** Mensagem `fromMe` que o bot não enviou pausa aquela conversa por algumas horas. | Bot sempre ativo | O dono vai responder pelo próprio celular; sem isso os dois falam ao mesmo tempo. |
| D10 | **Contexto injetado a cada turno:** data/hora atual em `America/Sao_Paulo` e agendamentos aguardando confirmação. | Depender só do histórico do bot | O lembrete sai do cron do Eliza, não do bot; sem isso um "sim" em resposta ao lembrete fica ambíguo. |

## Decisões em aberto

| # | Questão | Recomendação | Trade-off | Dono / prazo |
|---|---|---|---|---|
| A1 | Agendamento criado pelo bot nasce `scheduled` ou `pending`? | Configurável por org, padrão `scheduled` | Autonomia real da atendente 24h vs. tenant cauteloso precisar mudar o padrão | Sérgio — semana de 2026-09-28 |
| A2 | Config do add-on: tabela `org_addons` ou colunas em `organization_settings`? | Decidir no contrato da F0 | Tabela escala para outros add-ons; colunas são mais simples | Contrato F0 |
| A3 | Autenticação bot → Eliza: token de serviço único ou por org? | Decidir no contrato da F0 | Único é mais simples; por org limita o estrago de vazamento, mas o bot teria todos mesmo assim | Contrato F0 |
| A4 | Modelo de LLM e custo por tenant | Medir na F1 antes de fechar preço do add-on | — | F1 |
| A5 | Retenção do histórico (LGPD) | Definir prazo antes da F1 ir para tenant real | Mais tempo = mais contexto; menos = menos exposição | Antes do go-live |

A1 não bloqueia F0 nem F1: a F0 só precisa deixar o status de nascimento
parametrizável.

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

## Próximos passos

1. Sérgio decide A1.
2. Contratos da F0 (Zod em `src/contracts/` + `.md` por domínio), fechando A2 e A3.
3. Implementação da F0.
