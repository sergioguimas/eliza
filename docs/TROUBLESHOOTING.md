# Troubleshooting

## Horário com +3h

Sintoma: agendamentos aparecem três horas à frente.

Causa comum: formatar `timestamptz` sem `timeZone: "America/Sao_Paulo"` ou enviar ISO UTC para action que espera hora local.

Correções:

- usar `formatSaoPauloTime` e `formatSaoPauloDayMonth`;
- usar `Intl.DateTimeFormat` com `timeZone`;
- evitar `toISOString().split("T")[0]` para data local;
- enviar `YYYY-MM-DDTHH:mm:ss` quando a action converte hora local para UTC.

## Toast de erro no login mesmo logando

Causa: `redirect()` dentro de Server Action chamada por Client Component pode cair no `catch`.

Correção:

- `signIn()` retorna `{ success: true, redirectTo }`;
- o client chama `router.push()`.

Arquivo:

- `web/app/actions/auth.ts`
- `web/components/shared/login-form.tsx`

## WhatsApp conectado, mas status não aparece

Verificar:

- estados `open`, `connected`, `online`;
- normalização em `getWhatsappStatus()`;
- `cache: "no-store"`;
- instância baseada no slug certo.

Arquivos:

- `web/app/actions/whatsapp-connect.ts`
- `web/components/settings/whatsapp-settings.tsx`

## Preferências resetando

Causa comum: buscar dados de `organizations` em vez de `organization_settings`.

Correção:

- buscar `organization_settings`;
- passar para `PreferencesForm`;
- salvar com `upsert`;
- chamar `router.refresh()`.

Arquivos:

- `web/app/(app)/configuracoes/page.tsx`
- `web/components/settings/preferences-form.tsx`
- `web/app/actions/update-preferences.ts`

## QR Code não aparece

Verificar:

- URL da Evolution API;
- `EVOLUTION_API_KEY`;
- conectividade VPS/Tailscale;
- se instância já existe;
- logs de `createWhatsappInstance()`;
- retorno `data.qrcode.base64` ou `data.base64`.

## Supabase não envia e-mail de recuperação

Verificar:

- SMTP/Auth configurado no Supabase;
- Redirect URLs;
- `NEXT_PUBLIC_APP_URL`;
- template usando `{{ .ConfirmationURL }}`;
- spam/quarentena do domínio;
- logs de Auth.

## Redirect URL inválida

Adicionar no Supabase:

```txt
http://localhost:3000/auth/callback
https://eliza.sgdev.cloud/auth/callback
```

## Link de recuperação abre o login

Sintoma: o e-mail abre uma URL como:

```txt
/login#access_token=...&type=recovery
```

Causa provável: template do Supabase fixado em `/login` em vez de usar a URL de confirmação.

Correções:

- usar `{{ .ConfirmationURL }}` no template;
- manter o fallback de recovery em `web/components/shared/login-form.tsx`;
- gerar um novo link depois de publicar a correção.

## Callback retorna `recovery_link_invalid`

Sintoma:

```txt
/forgot-password?error=recovery_link_invalid
```

Verificar:

- link expirou ou já foi consumido;
- callback está cadastrada nas Redirect URLs;
- tokens ou parâmetro `code` chegaram à rota;
- cliente PKCE não processou antecipadamente um link implicit;
- logs do browser para `[AuthCallbackPage]`;
- data e hora do dispositivo estão corretas.

A callback captura os tokens antes de criar o cliente Supabase, limpa a URL e então estabelece a sessão manualmente. Para PKCE, chama `exchangeCodeForSession`.

## `/update-password` volta para solicitar o e-mail

Isso ocorre quando não existe sessão válida de recuperação.

Verificar:

- acesso foi feito pelo link recebido, não digitando a rota manualmente;
- callback concluiu sem erro;
- cookies do domínio estão habilitados;
- link não foi aberto anteriormente;
- usuário não tentou reutilizar um link antigo.

Solicite um novo e-mail e repita o fluxo completo.

## Senha alterada, mas login falha

Verificar:

- usuário está usando a nova senha;
- e-mail informado corresponde ao usuário recuperado;
- senha atende às regras mínimas;
- action executou `updateUser({ password })`;
- sessão de recuperação foi encerrada antes do novo login.

## Erro 500 ao criar usuário pelo Super Admin

Verificar:

- senha temporária não ultrapassa 72 caracteres;
- logs do Supabase Auth;
- trigger `on_auth_user_created`;
- função `public.handle_new_user`;
- constraints e permissões de `public.profiles`.

A senha temporária atual possui 40 caracteres. Falhas em triggers executadas após o insert em `auth.users` também aparecem como erro de criação de usuário.

## Cron rodando fora de horário

Verificar:

- timezone do agendador externo;
- `CRON_TZ=America/Sao_Paulo`;
- resposta JSON da rota com `timestamp_sp`;
- hora esperada do resumo diário.

## Agendamento fora do expediente

Verificar:

- `organization_settings.days_of_week`;
- `open_hours_start` e `open_hours_end`;
- `lunch_start` e `lunch_end`;
- `professional_availability`;
- `break_start` e `break_end`;
- status de agendamento existente que ocupa o horário.

## Erro de `organization_id` nulo

Verificar:

- usuário possui registro em `profiles`;
- `profiles.organization_id` preenchido;
- setup foi concluído;
- actions validam `profile.organization_id` antes de usar.

## Erro ao inserir `role` em `professionals`

Causa: `professionals` não possui coluna `role`.

Correção:

- role fica em `profiles.role`;
- `professionals` recebe `user_id`, `organization_id`, `name`, dados profissionais e `is_active`.

## Status `arrived` falhando no banco

Sintoma: erro ao marcar chegada/recepção.

Causa provável: a UI usa `arrived`, mas o `schema_public.sql` atual não inclui `arrived` no check constraint de `appointments.status`.

Decisão necessária:

- adicionar migration para permitir `arrived`; ou
- mapear a UI para status existente como `confirmed`/`completed`.

Não altere isso sem confirmar a regra de negócio de produção.

## PWA não instala

Nesta revisão não foi encontrado `manifest.ts`, `manifest.json` ou service worker. Confirmar se PWA está pendente, removido ou implementado fora do repositório.
