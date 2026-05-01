# Eliza

Eliza e uma plataforma SaaS multi-tenant e multi-nicho para gestao de negocios baseados em agenda, atendimento e relacionamento com clientes. O projeto nasceu com foco em clinicas, mas hoje tambem possui adaptacao de linguagem, identidade e dominio para barbearias, saloes de beleza, advocacia, certificadoras digitais e operacoes genericas de servicos.

O sistema combina painel interno, pagina publica de agendamento, controle de equipe, financeiro, historico/prontuario de atendimentos e integracao com WhatsApp via Evolution API.

## Estado Atual

- App web em Next.js 16, React 19, TypeScript e App Router.
- Interface com Tailwind CSS 4, Radix UI, componentes no estilo shadcn/ui, lucide-react, Recharts e Sonner.
- Backend implementado com Server Actions, Route Handlers e Supabase.
- Banco PostgreSQL no Supabase, com Auth, RLS, funcoes SQL, policies e tipos gerados em `web/utils/database.types.ts`.
- Multi-tenant por `organization_id`, com isolamento de dados por organizacao.
- Motor multi-nicho chamado Keckleon, responsavel por textos, entidades, branding e variacoes de dominio.
- Dockerfile e docker-compose prontos para deploy do app Next.js em container, com labels Traefik.

## Modulos Principais

### Autenticacao e onboarding

- Login com Supabase Auth.
- Setup inicial em `/setup` para criar organizacao, slug publico e nicho.
- Redirecionamento automatico para setup quando o usuario ainda nao pertence a uma organizacao.
- Painel super admin em `/admin`, protegido por e-mail configurado em variavel de ambiente.

### Multi-tenant e multi-nicho

- Cada organizacao possui `slug`, `niche`, status de assinatura, plano e configuracoes proprias.
- O Keckleon adapta nomes de entidades como clientes, pacientes, procedimentos, consultas, horarios, processos, certificados e historicos.
- Nichos mapeados atualmente: `clinica`, `barbearia`, `salao`, `advocacia`, `certificado` e `generico`.

### Agenda e atendimentos

- Agenda interna em `/agendamentos`.
- Criacao, edicao, cancelamento e exclusao de agendamentos.
- Validacao de disponibilidade por profissional.
- Status de atendimento: pendente, agendado, confirmado, chegou, finalizado e cancelado.
- Pagamento por agendamento, com metodo e status financeiro.
- Atualizacao em tempo real por componente dedicado de appointments.

### Pagina publica de agendamento

- Rota publica em `/marcar/[slug]`.
- Lista servicos e profissionais ativos da organizacao.
- Consulta horarios disponiveis.
- Cria pre-agendamentos como `pending`.
- Reaproveita cadastro existente por telefone/documento ou cria novo cliente automaticamente.
- Suporta documentos por nicho, como documento pessoal, carteirinha de convenio e pedido medico para clinicas.

### Clientes e historico

- Listagem e busca em `/clientes`.
- Perfil detalhado em `/clientes/[id]`.
- Cadastro, edicao e inativacao/remocao logica de clientes.
- Historico de agendamentos por cliente.
- Prontuario, historico, ficha tecnica ou anotacoes, conforme o nicho.
- Registros de atendimento com criacao, edicao, assinatura/finalizacao, vinculo a agendamento e impressao.
- Paginas de impressao em `/print/record/[id]` e `/print/history/[id]`.

### Servicos

- Catalogo em `/servicos`.
- Servicos/procedimentos com titulo, duracao, preco, cor e status ativo.
- Criacao, edicao, ativacao/desativacao e remocao.

### Financeiro

- Painel financeiro em `/dashboard/financas`.
- Resumo de entradas, saidas e indicadores do periodo.
- Filtro mensal.
- Lancamento e atualizacao de despesas.
- Ranking de faturamento por servico e por profissional.
- Distribuicao por forma de pagamento.

### Equipe e permissoes

- Gestao de equipe em `/configuracoes/equipe`.
- Roles principais: `owner`, `admin`, `professional` e `staff`.
- Convites por codigo em `/convite/[code]`.
- Registro de membros a partir de convite.
- Diferenca entre `profiles`, usados para acesso/permissao, e `professionals`, usados para agenda e execucao de servicos.

### Horarios e configuracoes

- Configuracoes gerais em `/configuracoes`.
- Perfil profissional do usuario vinculado.
- Preferencias da organizacao.
- Configuracoes de mensagens e WhatsApp.
- Agenda semanal por profissional em `/configuracoes/horarios`, com horarios de inicio, fim, intervalo e status ativo.

### WhatsApp e automacoes

- Integracao com Evolution API.
- Criacao/conexao/reset de instancia via QR Code.
- Envio de confirmacoes, cancelamentos, mensagens manuais e midias.
- Webhook em `/api/webhooks/whatsapp/[[...slug]]` para ler respostas recebidas.
- Confirmacao ou cancelamento automatico por palavras-chave.
- Registro de logs em `appointment_logs`.
- Cron em `/api/cron/send-reminders` para lembretes e resumos diarios, protegido por `CRON_SECRET`.

## Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Radix UI, shadcn/ui, lucide-react.
- **Backend:** Server Actions e Route Handlers do Next.js.
- **Banco:** Supabase PostgreSQL.
- **Auth:** Supabase Auth com SSR.
- **Realtime:** componentes preparados para atualizacao de agendamentos.
- **Mensageria:** Evolution API para WhatsApp.
- **Graficos/PDF:** Recharts e jsPDF.
- **Infra:** Docker, docker-compose e Traefik.

## Estrutura do Projeto

```text
.
+-- README.md
+-- LICENSE
+-- schema_public.sql
+-- supabase/
|   +-- config.toml
|   +-- migrations/
+-- web/
    +-- app/
    |   +-- (app)/
    |   +-- actions/
    |   +-- admin/
    |   +-- api/
    |   +-- convite/
    |   +-- login/
    |   +-- marcar/
    |   +-- print/
    |   +-- setup/
    +-- components/
    +-- hooks/
    +-- lib/
    +-- providers/
    +-- public/
    +-- services/
    +-- utils/
```

## Rotas Relevantes

| Rota | Finalidade |
| --- | --- |
| `/login` | Entrada no sistema |
| `/setup` | Criacao da primeira organizacao do usuario |
| `/dashboard` | Visao geral operacional do dia |
| `/dashboard/financas` | Indicadores financeiros |
| `/agendamentos` | Agenda interna |
| `/clientes` | Cadastro e busca de clientes/pacientes |
| `/clientes/[id]` | Perfil, historico e prontuario do cliente |
| `/servicos` | Catalogo de servicos/procedimentos |
| `/configuracoes` | Organizacao, preferencias, perfil e WhatsApp |
| `/configuracoes/equipe` | Membros, roles e convites |
| `/configuracoes/horarios` | Disponibilidade semanal dos profissionais |
| `/marcar/[slug]` | Agendamento publico por organizacao |
| `/convite/[code]` | Aceite de convite da equipe |
| `/admin` | Super admin de tenants |
| `/api/webhooks/whatsapp/[[...slug]]` | Webhook da Evolution API |
| `/api/cron/send-reminders` | Rotina protegida de lembretes |

## Banco de Dados

O schema principal esta documentado em `schema_public.sql`, as migracoes ficam em `supabase/migrations/` e os tipos usados pelo app estao em `web/utils/database.types.ts`.

Tabelas principais:

- `organizations`
- `organization_settings`
- `profiles`
- `professionals`
- `professional_availability`
- `customers`
- `services`
- `appointments`
- `appointment_logs`
- `service_records`
- `estimates`
- `expenses`
- `invitations`
- `notification_dispatches`

Funcoes importantes:

- `get_user_org_id()`
- `find_or_create_public_customer(...)`
- `request_public_appointment(...)`
- `sign_service_record(...)`
- `finalize_service_record(...)`

Regras centrais:

- Quase todas as entidades operacionais carregam `organization_id`.
- RLS isola dados por organizacao.
- Convites, agendamento publico, servicos ativos e profissionais ativos possuem regras especificas de leitura.
- Clientes sao normalizados e podem ser deduplicados por documento/telefone.
- Profissionais possuem disponibilidade propria e podem ter agenda independente.

## Variaveis de Ambiente

Crie `web/.env.local` para desenvolvimento local.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_GOD_EMAIL=
GOD_EMAIL=

NEXT_PUBLIC_EVOLUTION_API_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

CRON_SECRET=
```

Observacoes:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` sao obrigatorias para auth e acesso ao Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` e usado por fluxos administrativos, agendamento publico, convites, WhatsApp e rotinas cron.
- `NEXT_PUBLIC_GOD_EMAIL` protege a maior parte do painel super admin; `GOD_EMAIL` tambem e usado na tela de criacao manual de tenant.
- Variaveis da Evolution API sao necessarias para WhatsApp.
- `CRON_SECRET` deve ser enviado como `Authorization: Bearer <valor>` na rota de cron.

## Rodando Localmente

```bash
git clone https://github.com/sergioguimas/eliza.git
cd eliza/web
npm install
npm run dev
```

O app sobe, por padrao, em `http://localhost:3000`.

Scripts disponiveis em `web/package.json`:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Supabase Local

O projeto possui configuracao do Supabase CLI em `supabase/config.toml`.

Portas locais principais:

- API: `54321`
- Banco: `54322`
- Studio: `54323`
- Inbucket: `54324`

Fluxo esperado:

```bash
supabase start
supabase db reset
```

Depois disso, aponte as variaveis do app para a instancia local ou para o projeto remoto desejado.

## Docker

O app web possui Dockerfile proprio em `web/Dockerfile`.

```bash
cd web
docker build -t eliza-web .
docker run -p 3000:3000 --env-file .env eliza-web
```

Tambem ha `web/docker-compose.yaml` com container `elisa-app`, redes externas `public` e `private`, e labels Traefik para o dominio `eliza.sgdev.cloud`.

## Regras de Negocio

- Uma organizacao representa um tenant.
- O slug da organizacao define o link publico de agendamento.
- Um usuario pertence a uma organizacao via `profiles.organization_id`.
- Um profissional pode ou nao estar vinculado a um usuario.
- A agenda usa `professionals`, nao apenas `profiles`.
- Agendamentos publicos entram como pendentes e podem ser aprovados/rejeitados pela equipe.
- Agendamentos internos entram como agendados.
- A disponibilidade do profissional e validada antes de salvar um horario.
- Registros de atendimento podem ser vinculados ao cliente e ao agendamento.
- Mensagens de WhatsApp usam templates e configuracoes da organizacao quando disponiveis.

## Autor

Sergio Guimaraes

GitHub: https://github.com/sergioguimas
