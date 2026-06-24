# Setup Local

## Requisitos

- Node.js 20 ou compatível com Next.js 16.
- npm.
- Acesso a um projeto Supabase ou Supabase CLI para ambiente local.
- Variáveis de ambiente em `web/.env.local`.

## Instalação

```bash
cd web
npm install
npm run dev
```

Aplicação local:

```txt
http://localhost:3000
```

## `.env.local`

Exemplo mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_GOD_EMAIL=
GOD_EMAIL=

CRON_SECRET=dev-secret
CRON_TZ=America/Sao_Paulo

NEXT_PUBLIC_EVOLUTION_API_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

Use `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor. Nunca prefixe essa chave com `NEXT_PUBLIC_`.

## Supabase Local

O projeto possui `supabase/config.toml`.

```bash
supabase start
supabase db reset
```

Portas padrão do Supabase local:

- API: `54321`
- Banco: `54322`
- Studio: `54323`
- Inbucket: `54324`

Depois, aponte `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para o ambiente local ou remoto escolhido.

## Testar Login

1. Acesse `/login`.
2. Crie uma conta ou entre com usuário já existente.
3. Se o perfil não tiver organização, o app deve redirecionar para `/setup`.
4. Após setup, o app deve ir para `/dashboard`.

O login client-side espera que `signIn()` retorne `{ success: true, redirectTo }`; o redirect é feito pelo componente.

## Testar Supabase

1. Acesse `/setup`.
2. Crie uma organização com nome, slug e nicho.
3. Confirme no Supabase:
   - `organizations` recebeu a organização;
   - `profiles.organization_id` foi preenchido;
   - `profiles.role` virou `owner`;
   - `organization_settings` existe para a organização.

## Testar Agendamento Público

1. No painel, cadastre serviço ativo em `/servicos`.
2. Cadastre ou ative profissional.
3. Configure disponibilidade em `/configuracoes/horarios`.
4. Configure expediente em `/configuracoes`.
5. Acesse `/marcar/[slug]`.
6. Selecione serviço, profissional, data e horário.
7. Confirme que horários fora de expediente, intervalo ou dia sem atendimento mostram mensagem clara.

## Testar Recuperação de Senha

1. Configure Redirect URLs no Supabase:
   - `http://localhost:3000/auth/callback`
   - `https://eliza.sgdev.cloud/auth/callback`
2. Confirme que o template de recuperação usa `{{ .ConfirmationURL }}`.
3. Acesse `/forgot-password` ou `/reset-password`.
4. Envie o e-mail.
5. Abra o link recebido.
6. Confirme a passagem por `/auth/callback`.
7. Defina a nova senha em `/update-password`.
8. Confirme o retorno para `/login`.

Validações esperadas:

- e-mail obrigatório e válido;
- senha com pelo menos 8 caracteres;
- senha com letra;
- senha com número;
- confirmação igual.
- `/update-password` bloqueia acesso sem sessão válida;
- tokens são removidos da URL após a callback;
- a nova senha permite login após o encerramento da sessão de recuperação.
