# Arquitetura

## Visão Geral

Eliza é um app Next.js com backend no próprio App Router, usando Server Actions, Route Handlers e Supabase. O banco é PostgreSQL com RLS, Auth e funções SQL. O sistema é multi-tenant: quase toda entidade operacional carrega `organization_id`.

## Módulos

- `web/app/(app)`: painel autenticado.
- `web/app/actions`: Server Actions de domínio.
- `web/app/api`: rotas HTTP, cron e webhooks.
- `web/app/marcar/[slug]`: agenda pública.
- `web/components`: componentes de UI e fluxos.
- `web/lib`: helpers, Keckleon, validações e regras de agendamento.
- `web/providers`: providers de tema e Keckleon.
- `web/utils/supabase`: clients Supabase de browser, server e admin.
- `supabase/migrations`: histórico de alterações SQL.
- `schema_public.sql`: snapshot do schema público.

## Fluxo Multi-Tenant

1. Usuário entra pelo Supabase Auth.
2. `profiles.id` referencia o usuário do Auth.
3. `profiles.organization_id` define a organização do usuário.
4. Tabelas como `customers`, `services`, `appointments`, `professionals` e `organization_settings` usam `organization_id`.
5. RLS filtra dados pelo helper SQL `get_user_org_id()`.

## Autenticação e Recuperação

O fluxo de recuperação separa solicitação, validação do link e troca da senha:

```txt
/forgot-password ou /reset-password
  -> Supabase Auth
  -> /auth/callback
  -> /update-password
  -> /login
```

`/auth/callback` aceita PKCE e implicit recovery. A callback estabelece a sessão antes de abrir a página protegida de troca de senha e remove tokens da URL. Consulte [AUTH_E_RECUPERACAO.md](AUTH_E_RECUPERACAO.md).

## Perfis e Profissionais

`profiles` representa acesso ao sistema e permissão. `professionals` representa alguém que atende na agenda. Um usuário `admin` ou `professional` pode ter registro em `professionals`; `staff` normalmente não deve aparecer na agenda.

Não inserir `role` em `professionals`: o schema atual não possui essa coluna.

## Agendamento

Agendamentos usam `appointments.start_time` e `appointments.end_time` como `timestamptz`. A UI deve montar horários como hora local de São Paulo e o backend deve converter para UTC antes de persistir.

Regras principais:

- dia útil da organização;
- expediente da organização;
- disponibilidade do profissional;
- intervalo/almoço da organização;
- intervalo do profissional;
- bloqueio por sobreposição no banco;
- status `pending` para agenda pública e `scheduled` para agenda interna.

## WhatsApp

Integração via Evolution API. A instância costuma ser baseada no `slug` da organização. O sistema consulta status, gera QR Code, envia mensagens e recebe respostas no webhook.

Estados tratados como conectado:

- `open`
- `connected`
- `online`

## Cron

A rota `GET /api/cron/send-reminders` executa:

- `processDoctorDailySummaries`;
- `processPatientMorningReminders`.

A rota exige `Authorization: Bearer <CRON_SECRET>` e deve operar no timezone `America/Sao_Paulo`.

## Keckleon

Keckleon adapta linguagem e identidade por nicho. Dicionários ficam em `web/lib/dictionaries` e metadados visuais em `web/lib/niche-config.ts`.

Evite textos fixos como `Paciente`, `Consulta`, `Procedimento`, `Doutor` e `Clínica` fora de dicionários, telas específicas de exemplo ou documentação.

## PWA

O produto é tratado como PWA no escopo do projeto, mas nesta revisão não foi encontrado `manifest.ts`, `manifest.json` ou service worker no app. Isso deve ser confirmado antes de anunciar instalação offline como funcionalidade pronta.
