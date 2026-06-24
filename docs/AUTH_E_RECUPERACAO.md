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
| `/forgot-password` | Solicitar link de recuperação |
| `/reset-password` | Solicitar link de recuperação; mantida como rota compatível |
| `/auth/callback` | Validar o link, estabelecer a sessão e encaminhar o usuário |
| `/update-password` | Informar e confirmar a nova senha |

## Fluxo de Recuperação

1. O usuário acessa `/forgot-password` ou `/reset-password`.
2. A Server Action chama `supabase.auth.resetPasswordForEmail`.
3. O e-mail aponta para `/auth/callback?next=/update-password`.
4. A callback aceita:
   - PKCE por parâmetro `code`;
   - implicit recovery por `access_token` e `refresh_token` no fragmento da URL.
5. A callback estabelece a sessão e limpa os tokens da barra de endereço.
6. O usuário é encaminhado para `/update-password`.
7. A página confirma que existe uma sessão válida.
8. A action chama `supabase.auth.updateUser({ password })`.
9. A sessão de recuperação é encerrada.
10. O usuário entra novamente em `/login` usando a nova senha.

## Primeiro Acesso Criado pelo Super Admin

1. O Super Admin informa nome da empresa e e-mail do responsável.
2. O servidor gera uma senha temporária interna de 40 caracteres.
3. A Admin API do Supabase cria o usuário já confirmado.
4. A trigger `on_auth_user_created` cria ou atualiza `public.profiles`.
5. O sistema envia um e-mail de definição de senha.
6. A callback abre `/update-password?first_access=true`.
7. O responsável define a própria senha.

A senha temporária precisa permanecer com no máximo 72 caracteres, limite usado pelo BCrypt no Supabase Auth.

O fluxo administrativo atual cria o usuário e o perfil. A criação ou vinculação da organização continua sendo uma etapa separada do onboarding.

## Configuração do Supabase

Em **Authentication > URL Configuration**:

Site URL de produção:

```txt
https://eliza.sgdev.cloud/
```

Redirect URLs:

```txt
https://eliza.sgdev.cloud/auth/callback
http://localhost:3000/auth/callback
```

As rotas `/reset-password` e `/update-password` não precisam ser redirects diretos do Supabase, pois a entrada do e-mail deve passar por `/auth/callback`.

## Template de E-mail

No template de recuperação de senha, o link deve usar a URL de confirmação gerada pelo Supabase:

```html
<a href="{{ .ConfirmationURL }}">Redefinir senha</a>
```

Não fixe o link em `/login`, `/reset-password` ou `/update-password`. A variável `ConfirmationURL` contém o token e respeita o `redirectTo` enviado pela aplicação.

## Variáveis de Ambiente

Produção:

```env
NEXT_PUBLIC_APP_URL=https://eliza.sgdev.cloud
NEXT_PUBLIC_SITE_URL=https://eliza.sgdev.cloud
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
- `web/app/auth/callback/page.tsx`
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

