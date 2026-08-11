# Supabase

## Tabelas Principais

- `organizations`
- `profiles`
- `professionals`
- `services`
- `customers`
- `appointments`
- `professional_availability`
- `organization_settings`
- `appointment_logs`
- `service_records`
- `estimates`
- `expenses`
- `invitations`

## Relações Centrais

### `organizations`

Representa um tenant.

Campos importantes:

- `id`
- `name`
- `slug`
- `niche`
- `evolution_api_url`
- `evolution_api_key`
- `whatsapp_status`
- `plan`
- `subscription_status`

### `profiles`

Representa acesso ao sistema.

- `id` referencia `auth.users.id`.
- `organization_id` define o tenant.
- `role` controla permissões.

Roles:

- `owner`
- `admin`
- `professional`
- `staff`

### `professionals`

Representa quem atende na agenda.

- `organization_id`
- `user_id`
- `name`
- `license_number`
- `specialty`
- `phone`
- `is_active`

Não possui coluna `role`.

### `services`

No schema atual, usa:

- `title`
- `description`
- `duration_minutes`
- `price`
- `active`
- `color`

Algumas anotações antigas falam em `name`, `duration` e `is_active`; confira o schema antes de novas migrations.

### `appointments`

Campos principais:

- `organization_id`
- `customer_id`
- `professional_id`
- `service_id`
- `start_time`
- `end_time`
- `status`
- `price`
- `payment_method`
- `payment_status`

`start_time` e `end_time` são `timestamp with time zone`.

Status do `schema_public.sql` atual:

- `scheduled`
- `pending`
- `confirmed`
- `canceled`
- `completed`
- `no_show`

Ponto de atenção: a UI também usa `arrived`. Verifique a constraint de produção antes de depender desse status.

## Auth

Supabase Auth é usado para login, cadastro, recuperação de senha e criação administrativa de usuários.

Fluxo de recuperação:

1. `/forgot-password` ou `/reset-password`;
2. `supabase.auth.resetPasswordForEmail`;
3. redirect para `/auth/callback?next=/update-password`;
4. troca de `code` PKCE ou tokens implicit por uma sessão;
5. redirect para `/update-password`;
6. `supabase.auth.updateUser({ password })`;
7. encerramento da sessão de recuperação.

A callback também aceita links antigos que chegam em `/login#access_token=...&type=recovery`, encaminhando-os para o fluxo correto.

## Redirect URLs

Configure:

```txt
http://localhost:3000/auth/callback
https://eliza.sgdev.cloud/auth/callback
```

Variáveis recomendadas:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Produção:

```env
NEXT_PUBLIC_APP_URL=https://eliza.sgdev.cloud
NEXT_PUBLIC_SITE_URL=https://eliza.sgdev.cloud
```

## Service Role

`SUPABASE_SERVICE_ROLE_KEY` é usada em fluxos administrativos e backend:

- criação de tenant;
- criação/vínculo de organização;
- agendamento público;
- convites;
- cron;
- WhatsApp.

Cuidados:

- usar apenas em Server Actions, Route Handlers ou utilitários server-only;
- nunca expor em `NEXT_PUBLIC_*`;
- evitar retornar erros sensíveis para o client.

## RLS

RLS isola dados por organização, principalmente via `get_user_org_id()`.

Ao criar novas tabelas multi-tenant:

1. adicionar `organization_id`;
2. habilitar RLS;
3. criar policies por organização;
4. revisar acesso público se a tabela aparecer em `/marcar/[slug]`.

## Criação de Tenant

Fluxo atual esperado no super admin:

1. admin/GOD informa nome da organização e e-mail do responsável;
2. servidor gera senha temporária forte, com 40 caracteres e abaixo do limite de 72 do BCrypt;
3. Supabase Admin API cria usuário;
4. a trigger `on_auth_user_created` cria ou atualiza `profiles`;
5. sistema envia reset com destino final em `/update-password?first_access=true`;
6. `/auth/callback` estabelece a sessão;
7. responsável define a própria senha.

Ponto de atenção: `web/app/actions/admin-create-tenant.ts` cria o usuário e envia o link, mas não cria nem vincula uma linha em `organizations`. O onboarding da organização continua separado.

Detalhes completos em [AUTH_E_RECUPERACAO.md](AUTH_E_RECUPERACAO.md).
