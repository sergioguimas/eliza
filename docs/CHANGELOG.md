# Changelog

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
