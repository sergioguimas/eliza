# Autenticação, Primeiro Acesso e Recuperação de Senha

## Visão Geral

O Eliza usa Supabase Auth para:

- login e cadastro;
- criação administrativa de usuários;
- primeiro acesso por link de e-mail;
- recuperação e troca de senha.

O formulário que solicita o e-mail é separado do formulário que efetivamente altera a senha.

## Rotas

| Rota | Responsabilidade |
| --- | --- |
| `/login` | Login e fallback para links antigos de recuperação que terminem em `/login#...` |
| `/forgot-password` | Solicitar link de recuperação; mostra o aviso de link inválido/expirado (`?error=`) |
| `/reset-password` | Rota antiga: só redireciona para `/forgot-password`, repassando `?error=` |
| `/auth/confirm` | Entrada dos e-mails: valida o `token_hash` no servidor (`verifyOtp`), grava a sessão e encaminha |
| `/auth/callback` | Fluxo antigo (PKCE `code` / tokens no fragmento); mantida para links já enviados e para o `/login#...` |
| `/update-password` | Informar e confirmar a nova senha |

## Fluxo de Recuperação

1. O usuário acessa `/forgot-password`.
2. A Server Action chama `supabase.auth.resetPasswordForEmail`.
3. O e-mail aponta para `/auth/confirm?token_hash=...&type=recovery` (template abaixo).
4. `/auth/confirm` chama `supabase.auth.verifyOtp({ type, token_hash })` no servidor, grava a sessão em cookie e
   redireciona para `/update-password`.
5. A página confirma que existe uma sessão válida.
6. A action chama `supabase.auth.updateUser({ password })`.
7. A sessão de recuperação é encerrada.
8. O usuário entra novamente em `/login` usando a nova senha.

Link inválido, expirado, já usado ou substituído por um pedido mais novo volta para
`/forgot-password?error=recovery_link_invalid`, que explica o motivo.

### Por que `token_hash` e não o `code` do PKCE

O client SSR do Supabase usa PKCE: o `?code=` do link só troca por sessão no **mesmo navegador** que pediu a
recuperação, porque o *code verifier* fica num cookie dele. Aberto no app de e-mail do celular, em aba anônima ou em
outro aparelho, a troca falha (`both auth code and code verifier should be non-empty` no log do Auth) e o usuário
caía em `/forgot-password` sem explicação — bug visto em produção em 29/10/2026. O `token_hash` é validado no
servidor e não depende de nada guardado no navegador.

## Primeiro Acesso Criado pelo Super Admin

1. O Super Admin informa nome da empresa e e-mail do responsável.
2. O servidor gera uma senha temporária interna de 40 caracteres.
3. A Admin API do Supabase cria o usuário já confirmado.
4. A trigger `on_auth_user_created` cria ou atualiza `public.profiles`.
5. O sistema envia um e-mail de definição de senha.
6. O link (mesmo template de recuperação) passa por `/auth/confirm` e abre `/update-password`.
7. O responsável define a própria senha.

A senha temporária precisa permanecer com no máximo 72 caracteres, limite usado pelo BCrypt no Supabase Auth.

O fluxo administrativo atual cria o usuário e o perfil. A criação ou vinculação da organização continua sendo uma etapa separada do onboarding.

## Configuração do Supabase

Em **Authentication > URL Configuration**:

Site URL de produção:

```txt
https://eliza.solasoftware.com.br/
```

Redirect URLs:

```txt
https://eliza.solasoftware.com.br/auth/callback
http://localhost:3000/auth/callback
```

`/auth/confirm` não precisa estar na lista: o link do template é montado com `{{ .SiteURL }}` e não passa pelo
redirect do Supabase. As redirect URLs continuam valendo para o fluxo antigo (`/auth/callback`).

## Template de E-mail

Em **Authentication > Email Templates > Reset Password**, o link deve ser:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Redefinir senha</a>
```

Não usar `{{ .ConfirmationURL }}`: ela leva o `?code=` do PKCE, que só funciona no navegador que pediu o link.
Sem `next`, `/auth/confirm` encaminha para `/update-password`. O mesmo template serve aos e-mails de primeiro
acesso do Super Admin e aos enviados pelo Studio.

## Variáveis de Ambiente

Produção:

```env
NEXT_PUBLIC_APP_URL=https://eliza.solasoftware.com.br
NEXT_PUBLIC_SITE_URL=https://eliza.solasoftware.com.br
```

Desenvolvimento:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Quando essas variáveis não existem, o backend tenta obter protocolo e host dos headers da requisição.

## Arquivos Principais

- `web/app/actions/admin-create-tenant.ts`
- `web/app/actions/password.ts`
- `web/app/auth/confirm/route.ts`
- `web/app/auth/callback/page.tsx`
- `web/app/forgot-password/page.tsx`
- `web/app/reset-password/page.tsx`
- `web/app/update-password/page.tsx`
- `web/components/auth/forgot-password-form.tsx`
- `web/components/auth/reset-password-form.tsx`
- `web/components/shared/login-form.tsx`
- `web/lib/app-url.ts`

## Segurança

- Nunca registrar ou compartilhar URLs completas de recuperação: elas contêm tokens temporários.
- Links antigos, expirados ou já consumidos devem ser substituídos por um novo pedido.
- `/update-password` não deve abrir sem uma sessão autenticada de recuperação.
- O retorno da solicitação de reset não revela se o e-mail está cadastrado.
- `SUPABASE_SERVICE_ROLE_KEY` deve existir somente no servidor.

