# Demonstração (Tenant Demo)

## Visão Geral

`/demo/start` cria, sem cadastro, um tenant isolado (`organizations.is_demo = true`) para um
visitante experimentar o Eliza com dados de exemplo do nicho escolhido. Um tour guiado
(driver.js) narra o fluxo completo do produto: agendar, marcar chegada, finalizar, registrar
prontuário, agendar retorno, confirmar pagamento e ver os avisos automáticos simulados. O
tenant expira em 24h.

## Nichos disponíveis

`web/lib/demo/config.ts` — `DEMO_NICHES`: `clinica`, `psicologia`, `barbearia`, `salao`,
`advocacia`, `tatuador`, `generico`. Fica de fora `certificado` (não promovido
comercialmente). Todo valor precisa existir no CHECK `organizations_niche_check`.

## Criação do tenant

`POST /api/demo/start` (`web/app/api/demo/start/route.ts`):

1. Valida `niche` contra `DEMO_NICHES`.
2. Rate limit por hash de IP (`demo_rate_limits`, tetos em `DEMO_RATE_LIMITS`).
3. Cria usuário via `auth.admin.createUser` (service role) — obrigatório: `is_demo` e
   `expires_at` ficam fora dos GRANTs de coluna de `authenticated`, então um client normal
   toma `permission denied` tentando gravar essas colunas.
4. Insere `organizations` (`is_demo=true`, `expires_at=now()+24h`, `slug=demo-<uuid>`).
5. Insere `profiles` (`role='owner'`).
6. Roda o seed (`web/lib/demo/seed.ts` + `web/lib/demo/fixtures.ts`) — profissionais,
   serviços, clientes e agendamentos de exemplo por nicho.
7. `signInWithPassword` server-side → cookie de sessão normal. A partir daqui o visitante é
   indistinguível de um usuário real para RLS e Server Actions.
8. Redirect para `DEMO_ENTRY_PATH` (`/dashboard?tour=demo`).

## Isolamento e segurança

- **`is_demo`/`expires_at` fora do alcance do client**: nenhum GRANT de coluna para
  `authenticated`. O gate de UI (mostrar o tour) usa `user.user_metadata.is_demo`, que o
  próprio visitante poderia alterar — por isso não é fonte de confiança para nada que vira
  telemetria ou side effect real; `logDemoInteraction` sempre revalida `is_demo` no banco via
  service role.
- **`organizations` SELECT restrito por coluna** (migration
  `20260811120000_restrict_authenticated_select_on_organizations.sql`): `authenticated` só
  lê `id`, `name`, `slug`, `niche`. Fechou um furo onde qualquer usuário logado (não só
  demo) lia `whatsapp_instance_name`, `stripe_customer_id`, `plan` e `subscription_status`
  de qualquer organização, e podia reapontar o próprio `whatsapp_instance_name`.
- **Cron de lembretes reais ignora orgs demo**: `processPatientMorningReminders` e
  `processDoctorDailySummaries` (`web/app/api/cron/reminders.ts`) filtram
  `organization.is_demo = false`. Nenhum envio real de WhatsApp de lembrete chega a um
  visitante da demo por essa via.
- **WhatsApp real da demo não está implementado.** `sendDemoWhatsAppMessage`
  (`web/app/actions/demo/send-demo-whatsapp.ts`) existe como primitivo fail-closed (lê
  `DEMO_WHATSAPP_INSTANCE` do ambiente direto, nunca a coluna da org, recusa org não-demo ou
  expirada) mas **não está chamado por nenhuma UI** — nenhum componente o importa. O que o
  tour mostra é só a simulação descrita abaixo (`timeline`), sem enviar nada de verdade.
  Pendente: contratar chip virtual dedicado e definir `DEMO_WHATSAPP_INSTANCE` antes de
  ligar isso.

## Ciclo de vida

- `expires_at = now() + 24h` no momento da criação; não é renovado em reset (senão um
  visitante manteria o tenant vivo indefinidamente clicando em "recomeçar").
- Limpeza: `GET /api/cron/cleanup-demo` (`Bearer CRON_SECRET`), mesmo padrão de
  `send-reminders`. Apaga filhos antes da organização (sete tabelas referenciam
  `organizations` sem `ON DELETE CASCADE`) e remove o usuário de Auth órfão via
  `auth.admin.deleteUser`. `demo_interactions`/`demo_leads` sobrevivem com
  `organization_id = null` (telemetria e leads não somem com o cleanup).
  **Precisa estar na crontab da VPS, de hora em hora** — confirmar que a linha existe em
  produção:
  ```
  0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://eliza.sgdev.cloud/api/cron/cleanup-demo
  ```
- Reset manual (`web/app/actions/demo/reset-demo.ts`): esvazia e reseeda a mesma
  organização, preservando org/perfil/sessão. Botão "Recomeçar a demonstração" no passo
  final do tour.

## Tour guiado

- Config dos passos: `web/lib/demo/tour.ts` (`buildDemoTour(niche)`), copy vem do
  dicionário Keckleon do nicho — nunca texto fixo sobre as entidades.
- Motor: `web/components/demo/tour-guide.tsx`, driver.js. Mecanismos do tipo de passo:
  - `awaitsNavigation`: avança sozinho quando a rota muda (sem botão de avançar).
  - `awaitsEvent`: só avança quando um `CustomEvent` do produto dispara — não com clique em
    "Entendi". Eventos usados: `eliza:appointment-created`, `eliza:record-saved`,
    `eliza:return-resolved`, `eliza:appointment-paid`. Nenhum é específico de demo (custam
    zero pra tenants reais, ninguém mais escuta).
  - `autoRevealed`: a UI que resolve o passo (um modal) abre sozinha, não por clique no
    elemento destacado — o passo não tem `selector`, o driver.js centraliza o popover pelo
    seu próprio elemento-fantasma interno, e um timer (4s) derruba a apresentação sozinho em
    vez de esperar um clique que não vai vir.
  - `kind: "custom"`: cede o popover a um componente React próprio
    (`timeline-simulation.tsx`, `tour-cta.tsx`) — usado quando a UI não cabe num tooltip.
- **O CSS do driver.js desativa `pointer-events` na página inteira enquanto um passo está
  ativo**, com exceção só do elemento destacado e do próprio popover
  (`.driver-active *{pointer-events:none}`). Qualquer UI que abra por portal (diálogo,
  dropdown, menu de contexto, aba) fora do elemento destacado fica travada enquanto isso
  durar. Por isso todo passo popover derruba a apresentação assim que o visitante clica no
  alvo (`hidePopoverOnly`), e passos `autoRevealed` fazem isso via timer.
- **Ordem final dos passos** (12 no total, `stepNumber` = índice + 1):

  1. `resumo` — `/dashboard`, resumo do dia
  2. `abrir-agenda` — `/dashboard` → `/agendamentos`
  3. `novo-agendamento` — cria o agendamento real (`awaitsEvent`)
  4. `voltar-dashboard` — `/agendamentos` → `/dashboard`
  5. `timeline` — simulação dos avisos automáticos (`kind: custom`). Fica aqui, logo ao
     chegar no Dashboard, porque narra o que acontece **antes** do compromisso (lembrete,
     confirmação) — precisou de duas rodadas de ajuste pra sair de perto do fim, onde
     ficava cronologicamente invertido e, como efeito colateral, mostrava um agendamento
     diferente do que o visitante tinha acabado de criar (a busca é sempre "o próximo
     `scheduled` da org"; rodando cedo, o que o visitante criou ainda está `scheduled`).
  6. `chegou` — marcar chegada (ungated, checkpoint informativo)
  7. `finalizado` — finalizar atendimento → redireciona pra ficha do cliente
     (`awaitsNavigation`)
  8. `prontuario` — salvar o registro (`awaitsEvent: eliza:record-saved`)
  9. `retorno` — modal automático de sugestão de retorno (`autoRevealed`,
     `awaitsEvent: eliza:return-resolved`)
  10. `retorno-agendamento` — só acontece se o visitante escolher um preset de dias (não
      "Agora não"); a criação do retorno redireciona automaticamente de volta pra ficha do
      cliente (`autoRevealed`, `awaitsEvent: eliza:appointment-created`)
  11. `pago` — confirmar pagamento (`awaitsEvent: eliza:appointment-paid`)
  12. `cta` — resumo + captura de lead (`kind: custom`, `demo_leads`)

- Telemetria: `demo_interactions` (`tour_started`, `step_completed`, `tour_completed`,
  `tour_abandoned`, `lead_captured`). Constraint `demo_interactions_step_number_check`
  limita `step_number` a `1..12` — qualquer passo novo precisa caber nesse teto ou a
  migration precisa subir de novo (aplicar manualmente no Studio, sem MCP do Supabase).
- Passos `awaitsNavigation` nunca logam `step_completed` (só `advance()` loga, e esses
  passos resolvem por reancoragem de rota, não por `advance()` direto) — não é bug, é
  característica conhecida. `web/components/demo/tour-cta.tsx` (`RECAP_ORDER`) já lê a
  telemetria sabendo disso.

## Defaults de agendamento

`web/app/actions/demo/get-appointment-defaults.ts` +
`web/hooks/use-demo-appointment-defaults.ts` pré-preenchem o diálogo de criação (primeiro
profissional, primeiro serviço, segundo cliente do seed, primeiro slot livre) nos dois
pontos de entrada que se beneficiam disso: o botão "Novo horário" da agenda e o atalho
`?new=true` do dashboard sem `customer_id`. Clique direito num slot específico e o fluxo de
retorno (`?new=true&customer_id=X`) não recebem defaults — o cliente já vem certo.

## Dashboard: "Hoje" vs "Próximos dias"

`web/app/(app)/dashboard/page.tsx` busca uma janela de 14 dias (não só hoje) e separa em
dois blocos: "Hoje" (sempre visível, literal) e "Próximos dias" (só quando há algo além de
hoje). **Produto-wide, não gated por demo** — qualquer tenant se beneficia de não ver a
agenda vazia por causa do calendário (fim de semana, início de semana devagar). O anchor do
tour (`data-tour="dashboard-proximos"`) envolve os dois blocos, porque o passo "chegou" não
sabe de antemão em qual bloco o compromisso relevante vai cair.

## Arquivos principais

```
web/app/demo/start/                          página de entrada, seletor de nicho
web/app/api/demo/start/route.ts              criação do tenant
web/app/api/cron/cleanup-demo/route.ts        limpeza de tenants expirados
web/lib/demo/config.ts                        nichos, TTL, rate limits
web/lib/demo/seed.ts, fixtures.ts             dados de exemplo por nicho
web/lib/demo/cleanup.ts                       helper de exclusão em cascata manual
web/lib/demo/tour.ts                          config dos passos do tour
web/components/demo/tour-guide.tsx            motor do tour (driver.js)
web/components/demo/timeline-simulation.tsx   simulação dos avisos automáticos
web/components/demo/tour-cta.tsx              passo final, resumo e captura de lead
web/app/actions/demo/                         server actions (defaults, timeline, lead, reset, log)
```

## Problemas conhecidos / decisões de design

- **Reancoragem por rota pode pular passos silenciosamente.** Se o visitante sair do
  roteiro guiado (mexer num agendamento do seed em vez do que a demo pediu, navegar
  manualmente), o motor busca o primeiro passo cuja rota casa a partir do progresso salvo —
  passos pulados nesse meio-tempo não logam `step_completed`. Não trava a demo, só some com
  telemetria intermediária. Visitantes seguindo o tour normalmente não encontram isso.
- **Fim de semana / fora do horário comercial**: o agendamento padrão dos defaults pode
  cair num dia útil futuro em vez de hoje. O bloco "Hoje" do dashboard aparece vazio (`0
  hoje`) nesse caso — comportamento esperado, não bug.
- **WhatsApp real (Fase 8 do plano original) não fica implementado** — ver seção acima.
- Histórico completo de decisões, causas-raiz investigadas e rodadas de correção do tour:
  `getdemo/PLANO_DEMO_v2.md` (versionado) e `PLANO_DEMO.md`/`PLANO_DEMO_v3.md` (fora do
  controle de versão — notas de sessão, não documentação de referência).
