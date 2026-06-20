# Eliza

Eliza é um SaaS multi-tenant para gestão de agendas, clientes, profissionais, serviços e atendimentos. O foco original é clínicas, mas o sistema também se adapta a outros nichos por meio do mecanismo Keckleon, que troca linguagem, labels, mensagens e identidade visual por organização.

Produção atual:

```txt
https://eliza.sgdev.cloud
```

## Stack

- Next.js 16, React 19, TypeScript e App Router.
- Supabase Cloud, PostgreSQL, Auth, RLS e tipos gerados em `web/utils/database.types.ts`.
- Tailwind CSS 4, Radix UI, shadcn/ui, lucide-react, Recharts e Sonner.
- Evolution API para WhatsApp.
- Docker, VPS e Traefik.

## Funcionalidades Principais

- Multi-tenant por `organization_id`.
- Cadastro de organizações, usuários, profissionais, clientes e serviços.
- Agenda interna e página pública em `/marcar/[slug]`.
- Confirmação, cancelamento, lembretes e resumo diário via WhatsApp.
- Configuração de expediente da organização e disponibilidade por profissional.
- Painel financeiro e histórico/registros de atendimento.
- Recuperação de senha e primeiro acesso por link de e-mail.
- Keckleon para nichos como `generico`, `clinica`, `psicologia`, `barbearia`, `salao`, `advocacia`, `certificado` e `tatuador`.

## Estrutura

```txt
.
+-- README.md
+-- schema_public.sql
+-- docs/
+-- supabase/
|   +-- config.toml
|   +-- migrations/
+-- web/
    +-- app/
    +-- components/
    +-- lib/
    +-- providers/
    +-- services/
    +-- utils/
```

## Setup Rápido

```bash
cd web
npm install
npm run dev
```

Abra `http://localhost:3000`.

Crie `web/.env.local` com as variáveis necessárias. Para um guia completo, veja [docs/SETUP_LOCAL.md](docs/SETUP_LOCAL.md).

## Deploy Rápido

O app web possui `web/Dockerfile` e `web/docker-compose.yaml`. O compose atual publica o serviço `elisa-app` atrás do Traefik com host `eliza.sgdev.cloud`.

```bash
cd web
docker compose up -d --build
```

Antes do deploy, revise `.env`, redes externas `public` e `private`, certificados Traefik e URLs de redirect do Supabase. Detalhes em [docs/DEPLOY.md](docs/DEPLOY.md).

## Variáveis de Ambiente

Principais variáveis usadas pelo projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=https://eliza.sgdev.cloud
NEXT_PUBLIC_SITE_URL=https://eliza.sgdev.cloud

NEXT_PUBLIC_GOD_EMAIL=
GOD_EMAIL=

CRON_SECRET=
CRON_TZ=America/Sao_Paulo

NEXT_PUBLIC_EVOLUTION_API_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta em Client Components ou variáveis `NEXT_PUBLIC_*`.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Setup local](docs/SETUP_LOCAL.md)
- [Deploy](docs/DEPLOY.md)
- [Supabase](docs/SUPABASE.md)
- [WhatsApp / Evolution API](docs/WHATSAPP_EVOLUTION.md)
- [Cron e lembretes](docs/CRON.md)
- [Agendamento](docs/AGENDAMENTO.md)
- [Keckleon](docs/KECKLEON.md)
- [Roles e permissões](docs/ROLES_E_PERMISSOES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Tutoriais de uso](docs/TUTORIAIS_USO.md)
- [Changelog](docs/CHANGELOG.md)

## Rotas Importantes

| Rota | Uso |
| --- | --- |
| `/login` | Login |
| `/forgot-password` | Solicitar recuperação de senha |
| `/reset-password` | Definir nova senha |
| `/setup` | Criar organização inicial |
| `/dashboard` | Visão geral |
| `/agendamentos` | Agenda interna |
| `/clientes` | Clientes/pacientes |
| `/servicos` | Serviços/procedimentos |
| `/configuracoes` | Organização, preferências, WhatsApp e perfil |
| `/configuracoes/equipe` | Membros e hierarquia |
| `/configuracoes/horarios` | Disponibilidade semanal |
| `/marcar/[slug]` | Agendamento público |
| `/admin` | Super admin |
| `/api/webhooks/whatsapp/[[...slug]]` | Webhook WhatsApp |
| `/api/cron/send-reminders` | Cron protegido por `CRON_SECRET` |

## Observações Técnicas

- O timezone operacional é `America/Sao_Paulo`.
- Horários de agendamento são gravados como `timestamptz`, mas entradas de UI devem representar a hora local do Brasil.
- `profiles.role` controla permissão; `professionals` controla agenda e atendimento.
- `services` no schema atual usa `title`, `duration_minutes` e `active`.
- O código usa status `arrived`, mas o `schema_public.sql` atual ainda não lista esse valor no check constraint. Veja [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
