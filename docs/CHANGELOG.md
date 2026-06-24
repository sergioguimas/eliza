# Changelog

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
