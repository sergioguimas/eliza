# Plano de Implementação v2: Tenant Demo + Tour Guiado — Eliza

> Revisão do `PLANO_DEMO.md` original, corrigida contra o código real do repositório
> (`web/`, `schema_public.sql`) em 2026-08-09. O plano v1 assumia tabelas, rotas e
> arquitetura de auth que não existem no Eliza — ver seção "Correções aplicadas".

**Objetivo:** tenant demo isolado onde o visitante experimenta a rotina completa do Eliza
(agendar, concluir, retorno, prontuário, avisos WhatsApp) com tour guiado por nicho.
Dados expiram em 24h. CTA final captura lead.

**Escopo v1 (travado):** enxuta + timeline fast-forward, **sem** dashboard de analytics
(o logging em `demo_interactions` entra desde já, para o dashboard vir depois com histórico).

---

## Decisões travadas

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Conversão no Step final | **Captura de lead** (nome + contato + nicho) → tabela `demo_leads`. Signup self-serve fica para projeto separado, junto com o gating de planos. |
| 2 | Nichos oferecidos | **Somente os existentes**: `clinica`, `psicologia`, `barbearia`, `salao`, `advocacia`, `tatuador`, `generico`. Nada de odontologia/personal/estética. |
| 3 | Auth do usuário demo | **Auth user Supabase efêmero** via service role + sessão cookie normal. Zero policy RLS nova. |
| 4 | Escopo | Fases 1–8 + 10 abaixo. Dashboard de analytics adiado. |
| 5 | Biblioteca de tour | **driver.js** (leve, ~5kb, estilizável com CSS vars). Shepherd.js traz CSS próprio que conflita com Tailwind v4 + Radix. *Reversível — trocar depois é barato.* |
| 6 | WhatsApp | **Envio real** por chip virtual dedicado. O visitante informa o próprio número como *paciente* e recebe o lembrete de verdade. Não é mock. Ver Fase 8. |

## Premissas confirmadas

- ✅ `schema_public.sql` é o dump mais recente da produção.
- ✅ O cron é disparado pela **crontab da VPS**. O cleanup entra como mais uma linha, mesmo
  padrão de `Bearer CRON_SECRET`. Não vale trocar por `pg_cron`: perderia o log centralizado
  no container e a rota precisa de `auth.admin.deleteUser`, que é Node, não SQL.

## Fluxo de trabalho de banco

Não há MCP do Supabase nesta máquina — **por escolha**. Toda mudança de schema é entregue
como arquivo em `supabase/migrations/`, para ser copiada e executada no Studio web.
Nenhum passo deste plano executa DDL diretamente.

- Fase 1 → `supabase/migrations/20260809143000_demo_tenant.sql` ✅ escrita

---

## Correções aplicadas ao plano v1

| v1 dizia | Realidade |
|----------|-----------|
| tabelas `schedules`, `notes`, `users` | `appointments`, `service_records`, `profiles` |
| bloquear `subscriptions`, `billing_history`, `admin_logs` | **não existem** — billing são colunas de `organizations` |
| rotas `/lojista/*` | route group `(app)` → `/dashboard`, `/agendamentos`, `/clientes`, `/servicos` |
| provider em `_app.tsx` | App Router — `app/(app)/layout.tsx` |
| criar role `demo_visitor` + policies RLS | RLS existente já isola por `organization_id = get_user_org_id()` |
| criar `DemoNicheContext` + mapa `TERMINOLOGY` | Keckleon já faz isso (`useKeckleon` em 35 arquivos) |
| adicionar coluna `niche` | já existe, com CHECK constraint |
| 4 endpoints REST `/api/demo/*` | app usa Server Actions; só `start` precisa ser route handler |
| datas de seed em 2024 | seed relativo a `now()` |
| defaults fixos às 14:00 | EXCLUDE constraint GiST derruba colisões — usar `get-available-slots.ts` |

---

# FASE 1 — Banco + guard de segurança

**Por que primeiro:** o guard do WhatsApp é pré-requisito de segurança de tudo o mais.

### 1.1 Migration

```sql
ALTER TABLE public.organizations
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN expires_at timestamptz;

CREATE INDEX idx_organizations_demo_expiry
  ON public.organizations (expires_at) WHERE is_demo = true;
```

Tabelas novas:

- **`demo_interactions`** — `id`, `organization_id` fk, `action` (check: `tour_started`,
  `step_completed`, `appointment_created`, `appointment_completed`, `return_scheduled`,
  `record_added`, `whatsapp_viewed`, `timeline_viewed`, `tour_completed`, `tour_abandoned`,
  `lead_captured`), `step_number` int, `metadata` jsonb, `created_at`.
- **`demo_timeline_events`** — `id`, `organization_id` fk, `appointment_id` fk,
  `event_type` (check: `reminder_1h`, `client_confirmed`, `appointment_time`),
  `simulated_time` timestamptz, `message_text`, `response_text`, `created_at`.
- **`demo_leads`** — `id`, `organization_id` fk nullable, `name`, `contact`, `niche`,
  `source` default `'demo_tour'`, `metadata` jsonb, `created_at`.
- **`demo_rate_limits`** — `ip_hash` text pk, `window_start` timestamptz, `count` int.
  (Não há Redis no stack e memória não sobrevive ao restart do container.)

RLS: `demo_interactions`, `demo_timeline_events` seguem o padrão existente
(`organization_id = public.get_user_org_id()`). `demo_leads` e `demo_rate_limits`
sem policy — acesso apenas por service role.

### 1.2 🔴 Isolar o cron das orgs demo (crítico — bloqueia deploy)

`processPatientMorningReminders` e `processDoctorDailySummaries` selecionam `appointments`
por faixa de data, **sem nenhum filtro de organização** ([reminders.ts:150](../web/app/api/cron/reminders.ts)).
Uma org demo semeada entra na varredura e dispara lembrete agendado horas depois do tour —
mensagem inesperada, para um número real, fora de qualquer contexto.

Correção: `organizations!inner(is_demo)` no select das duas funções, filtrando `is_demo=false`.
**Todos os envios da demo são explícitos, comandados pelo tour.** O cron nunca toca demo.

### 1.3 ✅ Fail-closed na instância do WhatsApp — RESOLVIDO fora da demo

O `DEFAULT_INSTANCE = "admin-painel-1768703535"` não existe mais. A resolução em
[send-whatsapp.ts](../web/app/actions/send-whatsapp.ts) virou:

```
servidor  = web/lib/evolution.ts (único para todo o sistema)
instância = organizations.whatsapp_instance_name  // sem fallback
```

Sem instância gravada, o envio retorna `{ success: false }` e loga — nunca sai por
outro número. O mesmo vale para `sendWhatsAppMedia` e para `whatsapp-messages.ts`
(que derivava a instância do `slug`, uma terceira convenção).

O servidor Evolution é único e por env; as colunas `organizations.evolution_api_*` e
`organization_settings.whatsapp_instance_name` foram dropadas na migration
`20260809170000`.

**O que isso muda para a demo:** o tenant demo não precisa mais de caminho de envio
separado para não vazar pelo número admin — o fail-closed é global. Se a demo for
mandar WhatsApp de verdade, grave `organizations.whatsapp_instance_name` da org demo
no seed apontando para a instância dedicada da demo. Sem isso, ela simplesmente não
envia, que é o comportamento seguro.

### Testes
- [ ] Cron completo com org demo semeada → zero dispatches para a demo
- [ ] Org normal continua recebendo lembretes
- [ ] Org demo sem `whatsapp_instance_name` → envio abortado, nada sai pelo número admin

**Tempo:** 4–5h

---

# FASE 2 — Criação do tenant demo

### 2.1 `POST /api/demo/start` (route handler — precisa setar cookie de sessão)

Fluxo, espelhando `app/actions/admin-create-tenant.ts`:

1. Validar `niche` contra `getSetupNicheOptions()` (fonte única de verdade)
2. Rate limit por hash de IP em `demo_rate_limits`
3. Service role: `auth.admin.createUser({ email: demo-<uuid>@demo.eliza.local, password: random, email_confirm: true })`
4. Insert `organizations` — `is_demo=true`, `expires_at=now()+24h`, `slug=demo-<uuid>`, `plan='demo'`
5. Insert `profiles` — `organization_id` da org, `role='owner'`
6. Rodar seed (Fase 3)
7. `signInWithPassword` server-side → cookie Supabase normal
8. Log `tour_started`
9. Redirect `/dashboard?tour=demo`

**Não** existe JWT paralelo, **não** existe `authenticateDemo()`. A partir do passo 7 o usuário
demo é indistinguível de um usuário normal para todas as 35 server actions e para o RLS.

### Testes
- [ ] POST com nicho válido → org criada, profile ligado, sessão ativa, redirect
- [ ] Nicho inválido → 400; rate limit estourado → 429
- [ ] Sessão demo enxerga só a própria org (query cross-tenant volta vazia)
- [ ] Usuário real não é afetado

**Tempo:** 5–6h

---

# FASE 3 — Seed por nicho

`lib/demo/seed.ts` — recebe `organizationId` e `niche`.

Para cada nicho: 2 profissionais (+ `professional_availability`), 3 serviços, 2 clientes
(`phone` é NOT NULL — usar números fictícios; o guard da Fase 1.2 garante que nada sai),
2 agendamentos passados (`status='completed'`), 1 futuro.

**Regras que o v1 errou:**
- Datas **relativas a `now()`**, não literais de 2024.
- Horários calculados via `get-available-slots.ts`, respeitando a EXCLUDE constraint GiST
  de `appointments` — senão o tour estoura erro no meio.
- 1 `service_records` pré-existente por cliente antigo, para o histórico não parecer vazio.

Terminologia e branding: **nada a fazer** — vem do Keckleon via `organizations.niche`.

### Testes
- [ ] Seed dos 7 nichos sem violar constraint de overlap
- [ ] Executa em < 1s
- [ ] Labels corretos na UI por nicho (prontuário/briefing/paciente/cliente)

**Tempo:** 4–5h

---

# FASE 4 — Página `/demo/start`

`app/demo/start/page.tsx` — fora do route group `(app)` (não exige sessão).

Grid de cards com os 7 nichos, alimentado por `getSetupNicheOptions()` + branding do
`niche-config.ts` (ícone e cor já existem lá — não inventar novos). Loading state,
error state com retry, responsivo, navegável por teclado.

**Tempo:** 3h

---

# FASE 5 — Tour guiado

### 5.1 Config
`lib/demo/tour.ts` — passos por nicho, textos consumindo o dicionário do Keckleon
(`getDictionary(niche)`) em vez de strings hardcoded.

Passos: 1 Dashboard · 2 Criar agendamento · 3 Marcar concluído · 4 Agendar retorno ·
5 Prontuário · 6 Timeline fast-forward · 7 Aviso WhatsApp · 8 CTA lead.

### 5.2 Componente
`components/demo/tour-guide.tsx` (client). Montado no `app/(app)/layout.tsx` sob
`organization.is_demo`, não por query param — mais robusto contra refresh e navegação livre.

Adicionar `data-tour="..."` nos alvos: botão novo agendamento, card de agendamento,
ação de concluir, `return-prompt-dialog`, campo de prontuário.

**Pontas soltas que o v1 não previa — resolver aqui:**
- Passo atual persistido em `localStorage` por `organization_id` → refresh retoma
- Navegação para fora do trilho → tour reancorna no passo compatível com a rota
- Duas abas → o `localStorage` é a fonte única
- Fechar o tour → log `tour_abandoned` com `step_number`

**Tempo:** 6–8h

---

# FASE 6 — Defaults de agendamento

`hooks/use-demo-appointment-defaults.ts`: primeiro slot livre real (via `get-available-slots`),
serviço e cliente do seed pré-selecionados, **todos os campos editáveis**.

Tour só avança quando o agendamento existe no banco.

**Tempo:** 3–4h

---

# FASE 7 — Timeline fast-forward

### 7.1 Backend
Server action `createDemoTimeline(appointmentId)` — gera os 3 eventos (lembrete 1h antes,
confirmação do cliente, hora do agendamento) com textos do dicionário do nicho e grava
em `demo_timeline_events`. Não toca a Evolution API.

### 7.2 UI
`components/demo/timeline-simulation.tsx` — cards em sequência com `framer-motion`
(já é dependência), linha vertical conectando, timestamps, botão de avançar/pausar.

**Tempo:** 5–6h

---

# FASE 8 — WhatsApp real com chip dedicado

Esta é a maior mudança em relação ao v1, que previa mock. O visitante informa o **próprio
número como paciente** e recebe o lembrete de verdade, enviado pelo chip virtual dedicado.
É o momento mais forte do tour — a pessoa sente o produto no bolso — e também o único
ponto com superfície de abuso.

### 8.1 Configuração

- Nova instância Evolution para o chip dedicado, exposta como `DEMO_WHATSAPP_INSTANCE`.
- O seed grava esse valor em `organization_settings.whatsapp_instance_name` da org demo.
- Ausência da env → passo degrada para card estático. Nunca cai no número admin (Fase 1.3).

### 8.2 Controles de abuso (obrigatórios)

Sem isso, `/api/demo/start` vira um gateway aberto de WhatsApp para números arbitrários.

| Controle | Regra |
|---|---|
| Opt-in explícito | Checkbox marcado pelo visitante antes de informar o número. Log `whatsapp_opt_in`. |
| Um número por janela | `phone:<sha256>` em `demo_rate_limits`, 1 demo por número / 24h. |
| Teto por sessão | Máximo 2 mensagens por tenant demo, contadas em `demo_interactions`. |
| Conteúdo travado | Mensagens de catálogo fixo, parametrizadas só por nome e horário. **Nenhum texto livre do visitante entra no corpo.** |
| Rate limit por IP | Já coberto pelo `ip:<sha256>` da Fase 2. |
| Identificação | Toda mensagem abre com "Demonstração do Eliza, solicitada por você em eliza.sgdev.cloud" e explica como parar. |

### 8.3 UI

`components/demo/whatsapp-message-card.tsx` — bubble estilo WhatsApp mostrando o que foi
enviado, com o texto certo sobre o descompasso de tempo: *"enviamos agora no seu WhatsApp;
na operação real, sairia 1h antes do horário."*

### 8.4 Riscos aceitos

- **Ban do chip.** Denúncias de spam derrubam o número. Os controles acima reduzem, não
  eliminam. O chip é descartável por natureza — vale ter um segundo de reserva e trocar a
  env var, sem deploy.
- **LGPD.** O número é dado pessoal: opt-in explícito, finalidade declarada, e apagado junto
  com o tenant em 24h pelo cleanup da Fase 9.

### Testes
- [ ] Opt-in ausente → envio bloqueado
- [ ] Mesmo número duas vezes em 24h → segundo bloqueado
- [ ] 3ª mensagem na mesma sessão → bloqueada
- [ ] Payload com texto livre → não aparece no corpo da mensagem
- [ ] `DEMO_WHATSAPP_INSTANCE` ausente → card estático, zero envio
- [ ] Mensagem recebida sai pelo chip dedicado, não pelo admin

**Tempo:** 6–7h

---

# FASE 9 — Reset e cleanup

### 9.1 Reset manual
Server action: apaga dados da org demo, re-executa o seed, mantém a sessão.

### 9.2 Cleanup de expirados
Rota `GET /api/cron/cleanup-demo` com `Bearer CRON_SECRET`, no mesmo padrão de
`send-reminders`. Para cada org com `expires_at < now()`:
apaga dados → apaga org → **`auth.admin.deleteUser`** (senão o Supabase Auth acumula
usuários órfãos contando MAU) → log.

Entra como uma linha na crontab da VPS, de hora em hora. Não precisa ser diária: rodando
de hora em hora, o pior caso de sobrevida de um tenant expirado cai de 24h para 1h.

`demo_interactions` e `demo_leads` são `ON DELETE SET NULL` — sobrevivem ao cleanup, com o
nicho desnormalizado, para o dashboard de analytics nascer com histórico quando for a hora.
`demo_timeline_events` é cascata, some junto.

**Tempo:** 4h

---

# FASE 10 — CTA final e captura de lead

Passo 8 do tour: resumo do que o visitante fez (contado de `demo_interactions`),
form curto (nome + email ou WhatsApp), grava em `demo_leads`, log `lead_captured`,
notificação para você. Botão secundário: reiniciar tour.

**Tempo:** 3–4h

---

# FASE 11 — Testes

**E2E manual:** happy path (psicologia) · customização (tatuador) · abandono no passo 3
(verificar log) · reset · refresh no meio do tour · duas abas · mobile.

**Segurança:** cross-tenant demo→demo, demo→real, real→demo · rate limit ·
sessão expirada · XSS em campos livres · **cron completo com org demo ativa: zero envio real**.

**Tempo:** 5–6h

---

# FASE 12 — Deploy

Staging: migrations → seed → cenários da Fase 11 → 24h observando o cron.
Produção: backup → migrations → deploy → monitorar 24h.

Rollback: `is_demo` e `expires_at` são aditivos e as tabelas novas são isoladas —
reverter é desligar a rota `/demo/start`, sem tocar em dados de produção.

**Tempo:** 1 dia

---

# Resumo

| Fase | Tempo | Status |
|------|-------|--------|
| 1. Banco + isolamento do cron + fail-closed 🔴 | 4–5h | 🟡 migration escrita |
| 2. Criação do tenant demo | 5–6h | 🔴 TODO |
| 3. Seed por nicho | 4–5h | 🔴 TODO |
| 4. Página `/demo/start` | 3h | 🔴 TODO |
| 5. Tour guiado | 6–8h | 🔴 TODO |
| 6. Defaults de agendamento | 3–4h | 🔴 TODO |
| 7. Timeline fast-forward | 5–6h | 🔴 TODO |
| 8. WhatsApp real + controles de abuso | 6–7h | 🔴 TODO |
| 9. Reset e cleanup | 4h | 🔴 TODO |
| 10. CTA e lead | 3–4h | 🔴 TODO |
| 11. Testes | 5–6h | 🔴 TODO |
| 12. Deploy | 1 dia | 🔴 TODO |

**Total:** ~50–60h de desenvolvimento + 1 dia de deploy.

Paralelizável: 4 é independente de 2/3. 7 e 8 são independentes de 5/6.

**Risco:** médio, concentrado num único lugar. O isolamento de *dados* vem do RLS que já
existe e já roda em produção — isso é risco baixo. O risco real é o **WhatsApp**: a demo
envia mensagem de verdade para um número informado por um desconhecido. As Fases 1.2, 1.3
e 8.2 existem inteiramente por causa disso e são inegociáveis antes de qualquer deploy
público.

## Pendências operacionais (fora do código)

- [ ] Contratar o chip virtual e criar a instância na Evolution
- [ ] Definir `DEMO_WHATSAPP_INSTANCE` no `.env` da VPS
- [ ] Considerar um segundo chip de reserva (troca por env var, sem deploy)
- [ ] Executar `20260809143000_demo_tenant.sql` no Studio

**Fora de escopo (decidido):** signup self-serve, nichos novos (odontologia/personal/estética),
dashboard de analytics. O logging entra desde a Fase 1 para o dashboard nascer com histórico.
