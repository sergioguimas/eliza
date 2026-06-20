# Deploy

## Produção Atual

```txt
https://eliza.sgdev.cloud
```

O deploy esperado usa Docker em VPS com Traefik.

## Arquivos

- `web/Dockerfile`
- `web/docker-compose.yaml`

O compose atual usa:

- serviço `elisa-app`;
- porta interna `3000`;
- redes externas `public` e `private`;
- host Traefik `eliza.sgdev.cloud`;
- env file `web/.env`.

## Checklist Antes do Deploy

- `.env` criado no diretório `web`.
- `NEXT_PUBLIC_APP_URL=https://eliza.sgdev.cloud`.
- `NEXT_PUBLIC_SITE_URL=https://eliza.sgdev.cloud`.
- Redirect URLs configuradas no Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` presente só no servidor.
- `CRON_SECRET` forte.
- Evolution API acessível pela VPS.
- Redes Docker externas `public` e `private` existentes.
- Traefik com certresolver `meuresolver`, ou ajuste o label.

## Comandos

```bash
cd web
docker compose up -d --build
```

Ver logs:

```bash
docker logs -f elisa-app
```

Reiniciar:

```bash
docker compose restart elisa-app
```

## Variáveis de Produção

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

## Supabase

Em Authentication > URL Configuration, inclua:

```txt
https://eliza.sgdev.cloud/reset-password
http://localhost:3000/reset-password
```

Inclua também URLs usadas em fluxos de convite/cadastro se forem ativadas no Auth.

## Cron

Configure um job externo para chamar:

```txt
GET https://eliza.sgdev.cloud/api/cron/send-reminders
Authorization: Bearer <CRON_SECRET>
```

Use timezone `America/Sao_Paulo` no agendador sempre que ele permitir.

## Pós-Deploy

1. Abrir `/login`.
2. Validar login.
3. Validar `/dashboard`.
4. Validar `/marcar/[slug]`.
5. Validar recuperação de senha.
6. Validar QR Code e status do WhatsApp.
7. Rodar chamada manual do cron com `curl`.

