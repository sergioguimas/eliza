# Changelog

## 2026-10-06

### API v1 (etapa 4: escopo `payments`, gate de plano e documentação)

- Novo escopo de chave `payments`: `POST /api/v1/appointments/{id}/payment` passa a exigir `payments` (`write` não
  basta; `payments` sem `write` é válido). Chaves existentes não o ganham. A migration `20261006120100` já amplia o
  CHECK de `api_keys.scopes`.
- Configurações → API: o checkbox "Permitir escrita" virou dois ("Permitir escrita" e "Permitir baixa de pagamento"),
  ambos desmarcados por padrão (`read` sempre vai). A tabela mostra os escopos por extenso (Leitura, Escrita, Baixa de
  pagamento).
- Gate de plano (D7): `web/lib/api/planos.ts` com `PLANOS_COM_API` (hoje `"todos"`, sem mudança de comportamento).
  Com lista e plano fora dela: 403 `PLAN_REQUIRED` no autenticador de chave (depois da suspensão, antes do rate
  limit), a server action de criar chave recusa, e a tela avisa e bloqueia o botão. Regra numa função só
  (`planoPermiteApi`).
- `docs/API.md` reescrito conforme o contrato: escopos, rotas com escopo, envelope e catálogo de erros
  (`PLAN_REQUIRED`, `CUSTOMER_AMBIGUOUS`, horário passado = 409 `SLOT_UNAVAILABLE` com `sugestoes`), `DELETE`
  removido, `notify` só para cliente existente com teto de 60/h e `meta.notify_skipped`, `service_id` obrigatório em
  `/availability`, `method` de pagamento como enum e a regra de status D4.

### Domínio de agendamento (etapa 2: status, clientes e agendamentos; passos 3-4)

- `lib/domain/` ganha `status.ts` (máquina D4), `clientes.ts`, `mensagens.ts` e `agendamentos.ts`.
  Criar, editar, mudar status, cancelar, aprovar pedido, pagar e a resposta do webhook do WhatsApp
  passam todos por ele; `deleteAppointment` (DELETE físico) foi removido.
- Mudanças de comportamento desejadas:
  - Não se muda status fora da tabela: `completed`, `no_show` e `canceled` são finais; `pending` não
    vira `arrived`/`completed`; `arrived` não volta para `confirmed` nem vira `no_show`.
  - `no_show` só depois do horário de início, em qualquer canal. `STATUS_CONFIG` ganha "Faltou".
  - Remarcar/editar só em `pending`/`scheduled`/`confirmed`; remarcar valida ocupação, expediente e
    horário passado. O cliente só é avisado por WhatsApp se o horário mudou.
  - Criar no painel também recusa horário passado, ocupado ou fora do expediente.
  - Pagamento: método obrigatório e dentro do enum do banco; `canceled` e `no_show` não recebem; sinal
    antes de concluir é permitido; pagar duas vezes não reescreve `paid_at`.
  - Financeiro "a prazo" deixa de contar `pending` e `no_show`.
  - Toda escrita em `appointments` grava `appointment_logs` com `source` = origem (painel, publico,
    whatsapp_webhook).
  - Escrita condicionada ao status lido: alteração concorrente devolve "O agendamento foi alterado
    por outra pessoa; atualize a tela".
  - Cliente novo é procurado por telefone em qualquer forma BR (com/sem DDI e 9º dígito) e por
    documento: reusa o cadastro; mais de um casamento recusa com "Há mais de um cadastro...".
  - O webhook do WhatsApp só confirma agendamento `scheduled` (resposta "sim" a um `pending` não
    aprova mais o pedido).

### Domínio de agendamento (etapa 1: tempo, catálogo e horários)

- Nova `web/lib/domain/` (erros, tempo, catálogo, horários). Conversão de fuso numa
  fonte só (`lib/domain/tempo.ts`); `lib/api/tempo.ts` removido.
- Mudanças de comportamento desejadas:
  - A página pública `/marcar/[slug]` deixa de oferecer horário que já passou hoje.
  - Serviço longo deixa de ser oferecido onde não cabe: a janela testada é a duração do
    serviço, não a do passo da organização (serviço de 60 min não aparece às 11:30 com
    almoço às 12:00). O formulário público passa a enviar o serviço escolhido.
  - Ocupado passa a ser o conjunto de status ativos (`pending`, `scheduled`, `confirmed`,
    `arrived`), o mesmo da exclusion constraint; `completed` e `no_show` não bloqueiam mais.
  - `GET /api/v1/availability` exige `service_id` (sem ele, 422) e passa a responder
    `{ date, professional_id, service_id, slots, empty_reason }` com
    `meta: { timezone, grid_step_minutes }`; `message` e `example_start_time` saíram.
  - Data/hora de relógio inválida (30/02, 25h) passa a ser recusada em vez de "rolar" para
    outro dia.
- A página pública lê serviços e profissionais por colunas explícitas: `phone`,
  `license_number` e `user_id` do profissional não vão mais ao HTML.

## 2026-09-28 (tema escuro)

### Visual (tema escuro)

- Cada nicho ganhou um bloco `.dark .theme-<nicho>`: antes os tokens de marca só tinham
  valor claro, então no escuro o genérico renderizava botão primário preto sobre fundo
  preto (inclusive em `/login`, `/setup` e `/demo/start`), `text-primary` de tatuador,
  certificado e advocacia ficava abaixo de 2,5:1, e `bg-brand-soft` (item ativo da
  sidebar, cards de nicho) aparecia como um bloco quase branco. Primário a ~62% de
  luminosidade com texto escuro; `brand-soft` a 16% com texto a 82%.
- `--border` 15,9% → 20% e `--input` 15,9% → 28% no escuro: divisórias e campos eram
  1,20:1 contra o card e não se distinguiam.
- Anel de foco no escuro segue a cor do nicho, como no claro.
- Botões e marcadores `bg-success`/`bg-warning` usam `text-background` em vez de
  `text-white`: no escuro essas cores têm 58% de luminosidade e o branco caía para ~2:1.

## 2026-09-28

### Keckleon

- Novo nicho `manicure` (Manicure / Nail Designer): dicionário, metadados, ícones,
  documentos (referência de nail art), tema `.theme-manicure` (orquídea `296 30% 42%`),
  fixture de demonstração e migration `20260928120000_add_manicure_niche.sql` que
  recria o CHECK `organizations_niche_check`.

### Visual (tema claro)

- Tokens: `--muted-foreground` escurecido para 42% (5,6:1 sobre branco, 5,1:1 sobre
  `--muted`); `--input` para 80% para os campos se destacarem do fundo; `--ring` passa a
  seguir `--brand-ring`, então o campo em foco fica na cor do nicho; `--destructive` para
  `0 62% 44%` (6,25:1 com texto branco, o antigo `#EF4444` dava 3,76:1).
- Novos tokens categóricos `--cat-1..6` (claro e escuro) para distinguir profissionais na
  agenda; a agenda deixou de usar hex fixos e passou a ler `--status-*` e `--cat-*`, com
  o texto do card sempre em `--foreground` sobre um tinte leve.
- Removidas todas as classes de paleta fixa (`zinc`, `emerald`, `amber`, `red`, `blue`,
  `purple` etc.) fora de `/print`: texto quase invisível no claro
  (`text-zinc-300`/`text-zinc-400` na ficha do cliente), menus com foco em fundo escuro
  (`focus:bg-zinc-800`), botão de excluir em vermelho translúcido escuro, botão de
  imprimir azul, links roxos e ícones coloridos sem significado. Status passou para
  `success`/`warning`/`danger`/`info`; exclusão para `destructive`; decoração para
  neutro ou cor de marca.
- Texto em cor de status só sobre fundo neutro (sobre `bg-success/10` o contraste ficava
  em 4,05:1); badges de status usam `border-*/40 text-*`.

## 2026-08-16

### Demonstração

- Adicionado tenant de demonstração self-service em `/demo/start`: cria organização isolada
  (`is_demo`, expira em 24h) sem cadastro, com seed de dados por nicho (7 nichos) e tour
  guiado (driver.js) narrando todo o fluxo — agendar, marcar chegada, finalizar, registrar
  prontuário, agendar retorno, confirmar pagamento e ver os avisos automáticos simulados.
- Isolamento: coluna `is_demo`/`expires_at` fora dos GRANTs de `authenticated`; cron de
  lembretes reais ignora orgs demo; `organizations` restringiu SELECT de `authenticated` a
  `id/name/slug/niche` (fechou um furo pré-existente que também afetava tenants reais —
  qualquer usuário logado lia `stripe_customer_id`, `plan` e `whatsapp_instance_name` de
  qualquer organização e podia reapontar o próprio número de WhatsApp).
- Limpeza automática de tenants expirados via cron (`/api/cron/cleanup-demo`, hora em hora).
- Corrigido o overlay do driver.js bloqueando cliques fora do elemento destacado — passos
  agora derrubam a apresentação assim que a UI relevante abre, em vez de fechar o tour
  inteiro no primeiro clique acidental.
- Reordenados os passos do tour por duas vezes após teste real: prontuário passou a vir
  antes do retorno e do pagamento (o modal automático de retorno depende do prontuário já
  salvo); a simulação dos avisos automáticos saiu de perto do fim (depois do pagamento,
  ordem cronológica invertida) para logo após criar o agendamento, ao chegar no Dashboard.
- Estendido o fluxo de retorno: criar o agendamento de retorno agora redireciona
  automaticamente de volta para a ficha do cliente (mesmo padrão que "Finalizar" já usava),
  fechando um caminho que antes deixava o visitante solto na agenda sem saber que precisava
  voltar para confirmar o pagamento.
- Dashboard: "Próximos agendamentos" separado em blocos "Hoje" (sempre visível) e "Próximos
  dias" (só quando há algo além de hoje) — produto-wide, não só para demo. Corrige a agenda
  parecer vazia em fins de semana ou começo de semana devagar.
- Documentado em [docs/DEMO.md](DEMO.md).

## 2026-06-23

### Autenticação e Primeiro Acesso

- Corrigida a senha temporária do Super Admin para respeitar o limite de 72 caracteres do BCrypt/Supabase Auth.
- Mensagem de sucesso alterada de “Organização criada” para “Usuário criado”.
- Criada callback de autenticação compatível com PKCE e implicit recovery.
- Separadas as rotas de solicitação (`/reset-password`) e troca efetiva (`/update-password`).
- Adicionado fallback para links antigos de recuperação que terminem em `/login#...`.
- A página de troca de senha agora exige sessão válida e encerra a sessão de recuperação após salvar.
- Documentado o fluxo, as Redirect URLs e o template de e-mail do Supabase.

## 2026-06-20

### Nichos

- Adicionado nicho `psicologia` ao Keckleon, com metadados visuais, dicionário, ícones, documentos opcionais e migration de constraint.
- Adicionado nicho `tatuador` ao Keckleon, com metadados visuais, dicionário, ícones, documentos opcionais e migration de constraint.

### Documentação

- Criada documentação técnica em `docs/`.
- README reorganizado com visão geral, setup rápido, deploy rápido, variáveis e índice.
- Documentados Supabase, WhatsApp/Evolution, cron, agendamento, Keckleon, roles, troubleshooting e tutoriais.

### Revisão Técnica

- Ajustado agendamento público para enviar horário local em vez de ISO UTC para a action que converte hora de São Paulo.
- Ajustada edição de agendamento para aceitar `appointment_id`, preservar timezone de São Paulo, salvar observações e serviço enviados pelo formulário.
- Ajustada exibição de data/hora no modal de edição para `America/Sao_Paulo`.
- Ajustados fallbacks de texto em preferências para evitar “Consulta” e “paciente(s)” fora do Keckleon.
- Ajustado resumo diário do cron para preencher `{name}`, `{appointments}` e `{count}`.
- Removida variável morta em action de membros.

### Pontos de Atenção

- O código usa status `arrived`, mas o `schema_public.sql` atual não inclui esse valor na constraint de `appointments.status`.
- Não foi encontrado manifest/service worker de PWA no repositório.
- Há usos restantes de `date-fns format(new Date(...))` em páginas de impressão/histórico que merecem revisão futura de timezone.
