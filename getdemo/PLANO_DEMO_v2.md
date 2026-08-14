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

- Fase 1 → `supabase/migrations/20260809143000_demo_tenant.sql` ✅ **aplicada em produção**.
  As quatro tabelas `demo_*`, as colunas `is_demo`/`expires_at`, o CHECK e o índice de
  expiração estão de pé, e `web/utils/database.types.ts` já foi regenerado. Nada a executar
  antes de começar a codar.

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

### 1.2 ✅ Isolar o cron das orgs demo — FEITO

`processPatientMorningReminders` e `processDoctorDailySummaries` selecionam `appointments`
por faixa de data, **sem nenhum filtro de organização** ([reminders.ts:150](../web/app/api/cron/reminders.ts)).
Uma org demo semeada entra na varredura e dispara lembrete agendado horas depois do tour —
mensagem inesperada, para um número real, fora de qualquer contexto.

Correção aplicada em [reminders.ts](../web/app/api/cron/reminders.ts): `organization:organizations!inner(is_demo)`
no select das duas funções + `.eq("organization.is_demo", false)`.
**Todos os envios da demo são explícitos, comandados pelo tour.** O cron nunca toca demo.

Validado contra o banco de produção com query de leitura: `is_demo=false` retorna os 21
agendamentos reais, `is_demo=true` retorna 0 — se o filtro não estivesse sendo aplicado,
os dois retornariam 21. Nenhuma linha se perde no `!inner`, porque `appointments.organization_id`
é `NOT NULL` com FK para `organizations`.

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
separado para não vazar pelo número admin — o fail-closed é global.

⚠️ **Mas não siga a sugestão de gravar `organizations.whatsapp_instance_name` na org demo.**
Ver 1.4.

### 1.4 ✅ Sequestro de instância pelo visitante da demo — MITIGADO

A demo entrega uma **sessão `authenticated` real a um desconhecido**. Com a anon key
(pública) e o token da sessão, ele fala direto com o REST do Supabase, sem passar pelo app:

```sql
-- 1. authenticated tem SELECT em nível de TABELA (schema_public.sql:2301) e a policy
--    "Public profiles are viewable by everyone" é FOR SELECT USING (true), sem restrição
--    de role. Resultado: lê TODAS as colunas de TODAS as orgs.
select whatsapp_instance_name, stripe_customer_id, plan from organizations;

-- 2. authenticated tem GRANT UPDATE(whatsapp_instance_name) (schema_public.sql:2350) e a
--    policy "Users can update own org" libera a própria org.
update organizations set whatsapp_instance_name = '<instância de um tenant real>'
  where id = '<a própria org demo>';

-- 3. dispara o envio do tour → a mensagem sai pelo WhatsApp de um cliente real seu.
```

Gravar a instância dedicada na org demo, como a 1.3 sugere, é o que fecha essa cadeia:
a partir daí o visitante controla de qual número a demo envia.

**Correção aplicada, sem tocar no banco:** `sendDemoWhatsAppMessage` em
[send-demo-whatsapp.ts](../web/app/actions/demo/send-demo-whatsapp.ts) **não lê a coluna**.
Usa `DEMO_WHATSAPP_INSTANCE` do ambiente, direto, e `organizations.whatsapp_instance_name`
da org demo fica **nula**. O passo 3 morre mesmo que o visitante adultere o passo 2, e
qualquer caminho não-demo que escape do filtro do cron falha fechado pela 1.3.

A função também recusa org com `is_demo=false` (impede um tenant real de sair pelo chip da
demo por engano) e org com `expires_at` vencido. **Os controles de abuso da 8.2 são do
chamador** — a função é só o primitivo de envio e nunca deve receber texto livre do visitante.

> ⚠️ **Os passos 1 e 2 valiam para tenants reais, independente da demo:** qualquer usuário
> logado de qualquer tenant lia `whatsapp_instance_name`, `stripe_customer_id`, `plan` e
> `subscription_status` de todos os outros, e podia reapontar o próprio número.
> A demo não criava esse furo — ela o transformaria de "seus clientes se enxergam" em "a
> internet enxerga".
>
> **Fechado em `20260811120000_restrict_authenticated_select_on_organizations.sql`** (SELECT
> de `authenticated` restrito a `id/name/slug/niche`, `UPDATE(whatsapp_instance_name)`
> revogado, fluxo de conexão movido para service role). ⏳ **Falta executar no Studio** —
> enquanto não rodar, o furo está de pé em produção.

### Testes

Verificado agora (query de leitura contra produção):
- [x] Filtro embutido é aceito pelo PostgREST — a query do cron não quebra
- [x] Filtro discrimina: `is_demo=false` → 21 agendamentos, `is_demo=true` → 0
- [x] `!inner` não descarta linha nenhuma (`organization_id` é `NOT NULL` + FK)
- [x] `tsc --noEmit` limpo

Pendente até existir um tenant demo semeado (Fase 3):
- [ ] Cron completo com org demo semeada → zero dispatches para a demo
- [ ] Org normal continua recebendo lembretes (regressão)
- [ ] Org demo com `whatsapp_instance_name` nula envia pelo chip dedicado
- [ ] Sessão demo altera `whatsapp_instance_name` da própria org → envio do tour **continua
      saindo pelo chip dedicado**, ignorando a coluna
- [ ] `DEMO_WHATSAPP_INSTANCE` ausente → aborta, zero envio

**Tempo:** 4–5h

---

# FASE 2 — Criação do tenant demo

### 2.1 `POST /api/demo/start` (route handler — precisa setar cookie de sessão)

Fluxo, espelhando `app/actions/admin-create-tenant.ts`:

1. Validar `niche` contra `getSetupNicheOptions()` (fonte única de verdade)
2. Rate limit por hash de IP em `demo_rate_limits`
3. Service role: `auth.admin.createUser({ email: demo-<uuid>@demo.eliza.local, password: random, email_confirm: true })`

> 🔴 **O tenant demo tem que nascer por service role — não é preferência, é obrigatório.**
> `is_demo` e `expires_at` ficaram **de fora dos grants de coluna do `authenticated`**, de
> propósito: senão qualquer usuário marcaria a própria org como demo. Um client anônimo ou
> autenticado toma `permission denied` na coluna `is_demo`, e o erro **não** vai fazer sentido
> olhando a policy — quem barra é o privilégio de coluna, não o RLS.
> `createOrganization` em [organization.ts](../web/app/actions/organization.ts) é o modelo
> certo de client admin.
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

Implementado em [seed.ts](../web/lib/demo/seed.ts), com os dados por nicho separados em
[fixtures.ts](../web/lib/demo/fixtures.ts).

**Regras que o v1 errou:**
- Datas **relativas a `now()`**, não literais de 2024. E ajustadas para dia útil: um seed
  rodado na sexta jogaria compromisso no sábado, dia em que o profissional criado pelo
  próprio seed não atende.
- Não foi preciso usar `get-available-slots.ts`: o seed cria os profissionais, então sabe
  que a agenda está vazia. Os dois passados entram como `completed`, status que fica fora
  do índice de exclusão por profissional e portanto nunca colide com o que o visitante
  criar no tour.
- 1 `service_records` pré-existente no cliente recorrente, para o histórico não nascer vazio.

**Descobertas na implementação:**
- ⚠️ O trigger `handle_new_organization` **já cria um profissional padrão** ("Atendimento")
  junto com a organização — o mesmo trigger que cria `organization_settings`. Inserir os
  dois do fixture por cima deixava três, sendo um sem disponibilidade nem agenda. O seed
  agora reaproveita o padrão como o primeiro profissional.
- O compromisso futuro fica **hoje** sempre que ainda couber na jornada (até 15h, com folga
  de 2h e desviando da pausa do almoço); fora disso, no próximo dia útil. Os contadores de
  destaque do dashboard são todos de *hoje* — jogar o único compromisso para depois de
  amanhã fazia o visitante chegar num "0 hoje", a sensação de sistema parado que a
  demonstração existe para desfazer.

Terminologia e branding: **nada a fazer** — vem do Keckleon via `organizations.niche`.

### Testes
- [x] Seed dos 7 nichos, todos com 2 profissionais, 3 serviços, 2 clientes, 3 agendamentos
      e 1 registro — sem violar constraint
- [x] Cada profissional com as 5 faixas de disponibilidade, sem fantasma
- [x] Datas caem em dia útil (verificado com `-3` caindo em domingo e recuando para sexta)
- [x] Bordas da regra do compromisso de hoje, hora a hora
- [x] Nicho inexistente (`odontologia`) e nicho fora da demo (`certificado`) → 400

**Tempo:** 4–5h

---

# FASE 4 — Página `/demo/start`

`app/demo/start/page.tsx` — fora do route group `(app)` (não exige sessão).

Implementado em [page.tsx](../web/app/demo/start/page.tsx) e
[demo-niche-picker.tsx](../web/app/demo/start/demo-niche-picker.tsx).

Grid dos 7 nichos vindo de `getSetupNicheOptions()`, filtrado por `DEMO_NICHES`, com o
mesmo vocabulário visual dos cards de `/setup` — ícone, cor e gradiente já existiam no
`niche-config.ts`. Um clique já cria o tenant: card em estado de carregamento, os outros
esmaecidos e desabilitados, erro em `role="alert"`. São `<button>`, então teclado funciona
sem nada extra.

A navegação pós-criação é **dura** (`window.location.assign`), não `router.push`: o
endpoint acabou de gravar o cookie de sessão e o layout do app é renderizado no servidor —
um push de client poderia reaproveitar cache anterior à sessão e cair no `/setup`.

**Descobertas na verificação:**
- ⚠️ **A criação leva ~6s em dev** (`render: 5.7s`, fora o compile). São muitas idas ao
  Supabase em série: cria usuário, insere org, vincula perfil, semeia 6 conjuntos, faz
  login e loga a interação. Em produção deve cair, mas 6s de spinner numa landing é muito.
  Candidato a paralelizar os inserts do seed que não dependem uns dos outros.
- ✅ O card **Financeiro do dashboard tinha `R$` hardcoded**, sem valor. Corrigido: agora
  mostra o **recebido no mês**, somando `price` dos agendamentos `paid` e não cancelados
  pela mesma faixa de `getFinancialSummary` — o card e a `/dashboard/financas` que ele abre
  passam a mostrar o mesmo número (verificado no tenant demo de clínica: R$ 370,00 nos dois).
  Escolhido "mês" em vez de "hoje" justamente por causa da demo: o segundo atendimento pago
  só cai em hoje depois das 11h de um dia útil, então um card diário mostraria **R$ 0,00**
  em toda visita de fim de semana ou de manhã — a sensação de sistema parado que a
  demonstração existe para desfazer.
- ✅ **Fuso da faixa do mês corrigido, junto.** A faixa virou `getFinancialMonthRange` em
  [utils.ts](../web/lib/utils.ts), fonte única do card e de `getFinancialSummary`. Antes o
  mês vinha de `getFullYear`/`getMonth` (hora local) com limites em `Z`: na VPS, que roda em
  UTC, a janela ficava 3h adiantada — puxava as 21h–23h59 do último dia do mês anterior e
  largava de fora esse mesmo horário do último dia do mês corrente. Agora o mês sai do fuso
  de São Paulo e os limites levam `-03:00`. **Isso move levemente os números que a
  /dashboard/financas já mostra**, para o lado certo. Coberto por teste das bordas (meses de
  28/29/30/31 dias, virada de ano, contiguidade entre meses) sob cinco fusos de servidor.
- O ajuste do seed para o compromisso cair hoje não bastava: visitando às 18h, o dia útil
  já tinha acabado e a tela voltava a mostrar "0 hoje". O segundo atendimento concluído
  agora vai para as 9h de hoje quando já passou das 11h de um dia útil.

### Testes
- [x] Página carrega com os 7 nichos, `certificado` fora
- [x] Clique → estado de carregamento no card, demais desabilitados
- [x] Criação, redirect e dashboard com o dicionário do nicho aplicado (barbearia e psicologia)
- [x] Dashboard povoado: `SESSÕES 1 hoje`, `PACIENTES 2`, atendimento das 09:00 finalizado

**Tempo:** 3h

---

# FASE 5 — Tour guiado

### 5.1 Config
`lib/demo/tour.ts` — passos por nicho, textos consumindo o dicionário do Keckleon
(`getDictionary(niche)`) em vez de strings hardcoded.

Passos: 1 Dashboard · 2 Criar agendamento · 3 Marcar concluído · 4 Agendar retorno ·
5 Prontuário · 6 Timeline fast-forward · 7 Aviso WhatsApp · 8 CTA lead.

### 5.2 Componente
[tour-guide.tsx](../web/components/demo/tour-guide.tsx) (client), montado no
`app/(app)/layout.tsx`. Os 6 passos implementados percorrem
dashboard → agenda → ficha do cliente, acompanhando o caminho que o produto já faz
sozinho (concluir um atendimento redireciona para a ficha, onde o retorno é oferecido e
o registro é escrito). Os passos 7 e 8 — aviso de WhatsApp e CTA — entram nas Fases 8 e 10.

**Gate por `user_metadata.is_demo`, não por `organizations.is_demo`:** depois do
endurecimento de grants, o papel `authenticated` não enxerga mais a coluna. O metadata já
vem na sessão e não custa consulta. Como o próprio usuário consegue alterá-lo pela API de
auth, ele decide apenas se um balão aparece na tela — o que vira telemetria é revalidado
no servidor por `logDemoInteraction`, que confirma `is_demo` no banco e tira a organização
da sessão, nunca do cliente.

**Pontas soltas, resolvidas:**
- Passo persistido em `localStorage` por `organization_id` → refresh retoma
- Fora do trilho → a cada navegação o tour procura o primeiro passo da rota atual e nunca
  anda para trás; é isso que faz um passo de navegação se resolver sozinho
- Duas abas → o `localStorage` é a fonte única
- Fechar → `tour_abandoned` com `step_number`
- Alvo que ainda não montou → `MutationObserver` espera, com teto de 4s
- Navegação e mobile → a busca prefere o elemento **visível**, porque a barra de navegação
  existe duas vezes no DOM (desktop e mobile) e `querySelector` pegaria a escondida

**Descobertas na verificação:**
- ✅ **Não existia botão visível para criar agendamento** — criar era só por menu de contexto
  (clique direito num dia ou horário), nas três visões. O botão "Novo" existia em
  `create-appointment-dialog.tsx`, mas só no ramo não-controlado, que nenhum lugar usava: era
  código morto. **Resolvido:** botão na barra da agenda, acima do calendário, e atalho no
  cabeçalho do dashboard apontando para `/agendamentos?new=true` — parâmetro que o calendário
  já tratava, abrindo o formulário direto. Muda a UI de todos os tenants, não só da demo.
  O passo do tour voltou a apontar para o botão.
- A copy do tour é escrita para **não precisar concordar em gênero** com as entidades:
  "sessão" é feminino, "paciente" é masculino, e isso muda a cada nicho. A primeira versão
  dizia "quantos sessões". Os termos entram como substantivo solto, nunca com artigo ou
  quantificador.

### Testes
- [x] Passos 1→6 percorridos, com o dicionário de psicologia aplicado
- [x] Passo de navegação sem botões, resolvido ao trocar de rota
- [x] Progresso persistido a cada passo (`{"index":n,"done":false}`)
- [x] Fim do tour: overlay removido, `done:true`
- [x] Telemetria: `tour_started`, `step_completed` por passo, `tour_completed`

**Tempo:** 6–8h

---

# FASE 6 — Defaults de agendamento

Implementado em [get-appointment-defaults.ts](../web/app/actions/demo/get-appointment-defaults.ts)
(server action, reconfirma `is_demo` por service role) e
[use-demo-appointment-defaults.ts](../web/hooks/use-demo-appointment-defaults.ts) (hook client
que a chama ao montar `CalendarView`, antes de qualquer clique).

**O que entra pré-preenchido:** o primeiro profissional do seed, o primeiro serviço, o
**segundo** cliente do seed — o "novo", que fica sem nenhum agendamento na semeadura, então
marcá-lo fecha uma lacuna real da agenda em vez de empilhar mais um horário no mesmo nome — e
o primeiro slot **livre de verdade**, calculado com `getAvailableSlots` andando dia a dia (até
10) a partir de hoje. Todos os campos continuam editáveis; nada aqui é somente-leitura.

**Três pontos de entrada, dois recebem os defaults:**
- Botão "Novo horário" na barra da agenda → defaults completos
- Atalho `?new=true` do dashboard (sem `customer_id`) → defaults completos, com a montagem do
  formulário **esperando** o fetch resolver, porque é a única entrada onde vale a pena: o
  fetch já está em voo desde que a página carregou
- Clique direito num dia/horário específico, e `?new=true&customer_id=X` do fluxo de retorno →
  **sem alteração**. O primeiro é escolha deliberada do visitante; o segundo já traz o cliente
  certo e sobrepor um serviço ou horário genérico seria pior, não melhor

**Tour só avança quando o agendamento existe no banco — implementado com um evento, não com
o clique em "Entendi".** `create-appointment-dialog.tsx` dispara `window.dispatchEvent(new
CustomEvent("eliza:appointment-created"))` no sucesso — genérico, não gated por demo, inofensivo
para qualquer tenant porque só o tour escuta. `tour.ts` ganhou `awaitsEvent`, e o passo
"novo-agendamento" o usa: sem botão de avançar, só o evento resolve o passo.

⚠️ **Vazamento encontrado e corrigido durante a implementação.** A primeira versão guardava o
listener numa variável local dentro de `show()`. Se o visitante saísse da rota sem criar o
agendamento, o listener ficava pendurado no `window` — e se disparasse mais tarde, em outro
passo, `advance()` usaria o `index` capturado no closure antigo e corrompia o progresso já
salvo. Corrigido movendo a posse do listener para `destroyActive()`, a única função que já é
chamada em todo lugar que precisa desmontar o passo atual (início de cada novo passo, abandono,
unmount do componente) — verificado disparando o evento manualmente depois de fechar o tour sem
criar nada: progresso não se alterou.

### Descoberta fora do escopo

O botão de criar agendamento (agenda e diálogo) mostra `"Novo {agendamento}"` sem concordar
gênero — em `clinica`, onde a entidade é "Consulta" (feminino), o botão fica "Novo consulta".
Pré-existente, independente da demo, e visível na primeira tela onde o tour manda clicar.
Não corrigido aqui — mesma categoria do problema de concordância que apareceu no texto do
tour na Fase 5, mas desta vez em UI do produto, não em copy que eu controlo.

### Testes

Verificado contra o banco de produção, em quatro nichos (clínica, tatuador, barbearia):
- [x] Botão "Novo horário" abre com profissional, serviço, cliente e horário do seed
- [x] Slot calculado não colide com o compromisso já semeado (mesmo profissional, horários
      diferentes) — prova de que lê agenda real, não só disponibilidade estática
- [x] Fora do expediente (21h), avança corretamente para o próximo dia útil às 09:00 (horário
      da disponibilidade do profissional, mais restrito que o da organização)
- [x] Atalho do dashboard (`?new=true` sem `customer_id`) espera os defaults e abre preenchido
- [x] Fluxo de retorno (`?new=true&customer_id=X`) preserva o cliente da URL, sem serviço
      injetado — não interferido pelos defaults da demo
- [x] Criar o agendamento avança o tour sozinho, sem clique em "Entendi";
      `demo_interactions` grava `step_completed` no passo certo
- [x] Fechar o tour sem criar grava `tour_abandoned`; evento disparado depois não corrompe
      o progresso salvo

**Tempo:** 3–4h

---

# FASE 7 — Timeline fast-forward

### 7.1 Backend
[create-demo-timeline.ts](../web/app/actions/demo/create-demo-timeline.ts) — gera os 3 eventos
(lembrete 1h antes, confirmação do cliente 15min depois, hora do compromisso) com textos
parametrizados por nome do cliente, profissional e serviço, e grava em `demo_timeline_events`.
Não toca a Evolution API — `delivered_for_real` fica `false` nas três linhas.

**Mudança em relação ao desenho original: sem `appointmentId` como parâmetro.** A action deriva
o compromisso sozinha — o **próximo agendamento `scheduled` da organização**, por
`start_time ASC` — em vez de receber o id do agendamento que o visitante acabou de criar no
passo "novo-agendamento". Evita ter que carregar esse id entre passos e rotas (criado em
`/agendamentos`, usado em `/clientes/[id]`) só para uma feature que não precisa de precisão
cirúrgica: o seed sempre garante pelo menos um `scheduled`, então a busca nunca fica sem
resposta, mesmo se o visitante tivesse pulado a criação (o que hoje não é possível, já que o
passo anterior exige `awaitsEvent`).

Idempotente: reabrir o passo, ou refazer o tour, não duplica os três eventos — consultado antes
de inserir, por `appointment_id`. Confirmado gerando o mesmo tenant duas vezes seguidas: 3
linhas, não 6.

### 7.2 UI
[timeline-simulation.tsx](../web/components/demo/timeline-simulation.tsx) — modal com os cards
em sequência via `framer-motion`, linha vertical conectando, timestamps reais (o "fast-forward"
é só a apresentação; os horários simulados são os de verdade, podendo estar dias à frente),
botão de avançar/pausar, e "Entendi" só depois do último card.

**Não é um passo do tour comum — é a primeira coisa que não cabe num popover do driver.js.**
`tour.ts` ganhou `kind?: "popover" | "custom"`; o passo "timeline" é o primeiro `"custom"`.
[tour-guide.tsx](../web/components/demo/tour-guide.tsx) foi refeito para os dois tipos
dividirem a mesma lógica de avanço/abandono (`advance`/`abandonStep`, definidas uma vez por
passo e reusadas): para "popover" elas vão nos botões do driver.js, como antes; para "custom"
elas ficam em refs e são chamadas pelos callbacks `onDone`/`onSkip` do componente React
renderizado no lugar do popover.

Colocado **depois** do "prontuario", não entre "novo-agendamento" e "concluir" como uma leitura
mais literal do plano original sugeriria — fecha o arco da criação→conclusão→retorno→registro
com o compromisso que ficou para trás, bem antes do próximo passo (Fase 8) mostrar o aviso
saindo de verdade. Mesma rota do passo anterior (`/clientes/[id]`), sem navegação: é um modal
por cima de tudo.

### Testes

Verificado contra produção em dois nichos (salão, advocacia):
- [x] Compromisso, cliente, profissional e serviço corretos nas mensagens
- [x] Matemática do horário: reminder −60min, confirmação −45min, ambos batendo com o horário
      real do compromisso
- [x] Sequência revela sozinha (auto-play), "Pausar" desabilita quando termina, "Entendi"
      só aparece com os 3 cards visíveis
- [x] Concluir avança o tour (`tour_completed`, passo 7 — hoje é o último passo)
- [x] Fechar pelo X sem terminar grava `tour_abandoned` no passo certo, e os eventos já
      gerados continuam salvos (não é desperdício: só a apresentação foi interrompida)
- [x] Rodar duas vezes não duplica linhas em `demo_timeline_events`
- [x] Zero erro de console em toda a sequência

**Tempo:** 5–6h

---

# FASE 8 — WhatsApp real com chip dedicado

Esta é a maior mudança em relação ao v1, que previa mock. O visitante informa o **próprio
número como paciente** e recebe o lembrete de verdade, enviado pelo chip virtual dedicado.
É o momento mais forte do tour — a pessoa sente o produto no bolso — e também o único
ponto com superfície de abuso.

### 8.1 Configuração

- Nova instância Evolution para o chip dedicado, exposta como `DEMO_WHATSAPP_INSTANCE`.
- O envio da demo lê **a env, direto**. `organizations.whatsapp_instance_name` da org demo
  fica **nula** — o visitante tem `GRANT UPDATE` nessa coluna e poderia reapontá-la para a
  instância de um tenant real (Fase 1.4).
- Ausência da env → passo degrada para card estático, zero envio.
- `organization_settings.whatsapp_instance_name` não existe mais: foi dropada na migration
  `20260809170000`. A coluna viva é `organizations.whatsapp_instance_name`.

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
[reset-demo.ts](../web/app/actions/demo/reset-demo.ts) — esvazia a organização e semeia de
novo, preservando organização, perfil e sessão. A organização vem sempre da sessão, nunca de
parâmetro: a função apaga dados, e aceitar um id de fora deixaria o visitante apontá-la para
outro tenant.

A ordem de limpeza é própria (`RESET_TABLES`), diferente da do delete completo: `professionals`
entra, porque só sumiria por cascata da organização, que aqui continua de pé; e
`organization_settings` fica de fora, porque quem cria essa linha é o trigger do insert da
organização — apagá-la não teria quem a recriasse.

`expires_at` não é renovado, de propósito: renovar a cada reset permitiria manter um tenant
vivo indefinidamente clicando em "recomeçar".

⚠️ **Ainda sem quem chame.** O botão "Reiniciar tour" é da Fase 10. A ordem de exclusão foi
verificada contra um tenant povoado, mas o caminho completo pela sessão só será exercitado
quando a Fase 10 ligar o botão.

### 9.2 Cleanup de expirados
[cleanup-demo/route.ts](../web/app/api/cron/cleanup-demo/route.ts), `Bearer CRON_SECRET`, no
mesmo padrão de `send-reminders`. Para cada org com `expires_at < now()`, chama
`deleteDemoOrganization` de [cleanup.ts](../web/lib/demo/cleanup.ts). Uma organização com
falha não interrompe a varredura — as outras continuam vencendo enquanto aquela espera
investigação. Acima de 100 remoções numa passagem, loga aviso: volume atípico é sinal de
automação em cima da demonstração, ou de cron parado.

⚠️ **Apagar a organização direto não funciona.** Sete tabelas referenciam
`organizations` sem `ON DELETE CASCADE` (`appointments`, `customers`, `estimates`,
`organization_settings`, `profiles`, `service_records`, `services`), e um trigger cria
`organization_settings` no insert da org — então o delete falha com violação de FK.
Descoberto na prática ao limpar o tenant de teste da Fase 2. O helper apaga na ordem
filha-antes-de-mãe e recusa organização com `is_demo=false`, para nunca poder ser
apontado a um tenant real.

O `auth.admin.deleteUser` também está lá dentro: sem ele o Supabase Auth acumula
usuários órfãos contando MAU.

Entra como uma linha na crontab da VPS, de hora em hora. Não precisa ser diária: rodando
de hora em hora, o pior caso de sobrevida de um tenant expirado cai de 24h para 1h.

`demo_interactions` e `demo_leads` são `ON DELETE SET NULL` — sobrevivem ao cleanup, com o
nicho desnormalizado, para o dashboard de analytics nascer com histórico quando for a hora.
`demo_timeline_events` é cascata, some junto.

### Pendência operacional

Linha na crontab da VPS, de hora em hora:

    0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://eliza.sgdev.cloud/api/cron/cleanup-demo

### Testes
- [x] Sem header e com segredo errado → 401
- [x] Com segredo correto → `{"expired":1,"removed":1,"failed":[]}`
- [x] Só o vencido some; o tenant dentro do prazo permanece
- [x] Usuário de auth do vencido removido (não acumula MAU)
- [x] Dados do vencido zerados (agendamentos, clientes)
- [x] Telemetria sobrevive órfã (`organization_id` nulo)
- [x] Ordem do reset: tudo esvaziado sem erro de FK, `professional_availability` cascateia,
      organização e perfil preservados, `organization_settings` intacta

**Tempo:** 4h

---

# FASE 10 — CTA final, captura de lead e reset

Implementada antes da Fase 8, por decisão do Sérgio — fecha o loop do reset (Fase 9), que
estava sem quem o chamasse.

Passo 8 do tour (`kind: "custom"`, o segundo depois da timeline — `stepNumber` bate exatamente
com o teto de 8 que `demo_interactions_step_number_check` já previa).
[tour-cta.tsx](../web/components/demo/tour-cta.tsx): resumo do que o visitante fez, form de
nome + contato, e "Recomeçar a demonstração".

**Sem notificação a você.** Decisão explícita: não há e-mail (nem Resend/SMTP) nem WhatsApp
(a Fase 8 não existe ainda) configurado no projeto. O lead fica em `demo_leads`, consultável
quando quiser. Plugar aviso automático fica para quando um dos dois canais existir.

**O resumo lê `demo_interactions`, não conta linhas de `appointments`/`service_records`.**
A organização já nasce com dados do seed — contar entidades misturaria o que veio pronto com
o que o visitante realmente fez. [get-demo-recap.ts](../web/app/actions/demo/get-demo-recap.ts)
extrai os `metadata->>step` distintos entre os `step_completed` daquela org.

**Terminar aqui conta como tour concluído, com ou sem lead.** "Só terminar" chama a mesma
`onDone` que o envio bem-sucedido — só o fechamento implícito (X, Esc, clique fora) é abandono.
Chegar até o último passo já significa que o visitante viu tudo; declinar o contato não é a
mesma coisa que sair no meio do caminho.

**Reset ligado ao botão:** chama `resetDemo()` (Fase 9), limpa o progresso do tour no
`localStorage` e navega para `/dashboard` — a reseed troca os ids de clientes/agendamentos, e
a rota atual (`/clientes/[id]`) fica apontando para um registro que não existe mais.

⚠️ **Bug de ordem encontrado e corrigido na verificação.** A primeira versão limpava o
`localStorage` **antes** de chamar `onDone()` — mas `onDone()` (via `advance()`) persiste
`{done:true}` na mesma chave, reescrevendo por cima do que acabara de ser removido. O reset em
si funcionava (dados trocavam de id, corretamente), só o tour nunca voltava a aparecer depois.
Corrigido invertendo a ordem: `onDone()` primeiro, `removeItem` depois.

### Testes

Verificado contra produção:
- [x] Resumo mostra só os passos com `step_completed` real, na ordem narrativa certa —
      confirmado com 4 de 5 itens presentes e "timeline" corretamente ausente
- [x] Envio do lead grava em `demo_leads` com os campos certos, loga `lead_captured` (passo 8)
      e `tour_completed` em seguida
- [x] "Só terminar" não grava lead, mas loga `tour_completed` mesmo assim
- [x] Reset: nova geração de clientes/agendamentos com ids diferentes dos anteriores,
      `organization_settings` preservada, tour reaparece do passo 1 depois do reset
- [x] Zero erro de console em toda a sequência

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
| 1. Banco + isolamento do cron + anti-sequestro | 4–5h | 🟢 **DONE** |
| 2. Criação do tenant demo | 5–6h | 🟢 **DONE** (verificado ponta a ponta) |
| 3. Seed por nicho | 4–5h | 🟢 **DONE** (7 nichos verificados) |
| 4. Página `/demo/start` | 3h | 🟢 **DONE** (verificado no browser) |
| 5. Tour guiado | 6–8h | 🟢 **DONE** (6 passos; 7–8 nas Fases 8 e 10) |
| 6. Defaults de agendamento | 3–4h | 🟢 **DONE** (verificado em 4 nichos, sem colisão de horário) |
| 7. Timeline fast-forward | 5–6h | 🟢 **DONE** (verificado em 2 nichos, idempotência confirmada) |
| 8. WhatsApp real + controles de abuso | 6–7h | 🔴 TODO |
| 9. Reset e cleanup | 4h | 🟢 **DONE** (cron verificado; reset sem caller até a Fase 10) |
| 10. CTA, lead e reset | 3–4h | 🟢 **DONE** (feita antes da 8; fecha o loop do reset) |
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
- [x] ~~Executar `20260809143000_demo_tenant.sql` no Studio~~ — aplicada
- [ ] **Executar `20260811120000_restrict_authenticated_select_on_organizations.sql` no
      Studio** (Fase 1.4). Decidido: SELECT de `authenticated` restrito a colunas, como já é
      feito para `anon`. Migration e ajustes de código prontos. Não bloqueia o
      desenvolvimento; **bloqueia o deploy público da demo**.

**Fora de escopo (decidido):** signup self-serve, nichos novos (odontologia/personal/estética),
dashboard de analytics. O logging entra desde a Fase 1 para o dashboard nascer com histórico.
