# Deploy

## Produção Atual

```txt
https://eliza.solasoftware.com.br
```

O deploy esperado usa Docker em VPS com Traefik. Na VPS da Sola (`srv1394604`) o repo fica em
`/opt/stacks/solasoftware/eliza` (app em `web/`).

## Arquivos

- `web/Dockerfile`
- `web/docker-compose.yaml`

O compose atual usa:

- serviço `elisa-app`;
- porta interna `3000`;
- redes externas `proxy_net` e `evo_net` (e `proxy_net` também no `eliza-media`);
- host Traefik `eliza.solasoftware.com.br`;
- env file `web/.env`.

## Checklist Antes do Deploy

- `.env` criado no diretório `web`.
- `NEXT_PUBLIC_APP_URL=https://eliza.solasoftware.com.br`. **Obrigatória:** sem ela o envio de fotos responde 403
  ("Origem não permitida") e as URLs das fotos saem erradas. Faltava em produção até 10/11/2026.
- `NEXT_PUBLIC_SITE_URL=https://eliza.solasoftware.com.br`.
- Redirect URLs configuradas no Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` presente só no servidor.
- `CRON_SECRET` forte.
- `WHATSAPP_WEBHOOK_SECRET` forte e a URL do webhook na Evolution já com o
  segredo no caminho (subir o código antes de trocar a URL na Evolution faz
  as respostas "sim/não" dos clientes caírem em 401 até a troca).
- Evolution API acessível pela VPS.
- Redes Docker externas `proxy_net` e `evo_net` existentes.
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
NEXT_PUBLIC_APP_URL=https://eliza.solasoftware.com.br
NEXT_PUBLIC_SITE_URL=https://eliza.solasoftware.com.br
NEXT_PUBLIC_GOD_EMAIL=
GOD_EMAIL=
CRON_SECRET=
CRON_TZ=America/Sao_Paulo
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
WHATSAPP_WEBHOOK_SECRET=
DEMO_RATE_LIMIT_SALT=
AUTOATENDIMENTO_API_TOKEN=
AUTOATENDIMENTO_TICKET_SECRET=
ATENDENTE_URL=
ATENDENTE_ENCAMINHAMENTO_SECRET=
# Opcionais (biblioteca de fotos, ver "Fotos"; os padrões já valem em produção):
# MEDIA_DIR=/data/media
# MEDIA_PUBLIC_BASE=https://eliza.solasoftware.com.br/media
```

`WHATSAPP_WEBHOOK_SECRET` é obrigatória: sem ela o webhook de entrada do
WhatsApp responde 503 para tudo (fail-closed). Gere com
`openssl rand -hex 32` e use o mesmo valor na URL do webhook da Evolution —
ver `docs/WHATSAPP_EVOLUTION.md`, seção Webhook.

### Autoatendimento (add-on do Atendente Eliza)

Quatro envs, nenhuma `NEXT_PUBLIC_*`, todas só no servidor do Eliza (contrato em
`docs/contratos/autoatendimento/01-configuracao.md`):

| Env | Uso |
|---|---|
| `AUTOATENDIMENTO_API_TOKEN` | Bearer que o atendente envia em `/api/v1/autoatendimento/*`. Mesmo valor no atendente. |
| `AUTOATENDIMENTO_TICKET_SECRET` | HMAC do ticket de conversa. Existe só no Eliza, nunca no atendente. |
| `ATENDENTE_URL` | Base do serviço, ex.: `http://eliza-atendente:4100`. Vazia = encaminhamento desligado globalmente (usada no bloco B). |
| `ATENDENTE_ENCAMINHAMENTO_SECRET` | HMAC do encaminhamento Eliza -> atendente (bloco B). |
| `ATENDENTE_TREINO_SECRET` | HMAC do treino do atendente (contrato 10), mínimo de 32 caracteres. Mesmo valor de `ELIZA_TREINO_SECRET` no agens. Vazia = a página `/configuracoes/atendente` avisa que o treino não está disponível. |

Gere cada valor com `openssl rand -hex 32` (não repita o `CRON_SECRET=123456`).
O código recusa token e segredo de ticket com menos de 32 caracteres: sem
`AUTOATENDIMENTO_API_TOKEN` e `AUTOATENDIMENTO_TICKET_SECRET` válidos, toda rota
do canal responde 500 `INTERNAL_ERROR` (falha fechada) e o motivo vai só para o
log (`[autoatendimento:autenticar]`). Rotação = trocar a env nos dois lados.

Sem linha em `autoatendimento_config` (ou com `ativo = false`) o add-on está
desligado para a org: `ADDON_INACTIVE`. Na F0 a linha se cria pelo Studio.
O `web/.env.example` lista as variáveis; este arquivo é o
registro das variáveis.

## Supabase

Em Authentication > URL Configuration, inclua:

```txt
https://eliza.solasoftware.com.br/auth/callback
http://localhost:3000/auth/callback
```

Inclua também URLs usadas em fluxos de convite/cadastro se forem ativadas no Auth.

No template de recuperação de senha, use:

```html
<a href="{{ .ConfirmationURL }}">Redefinir senha</a>
```

Não fixe o destino em `/login`, `/reset-password` ou `/update-password`.

## Cron

Configure um job externo para chamar:

```txt
GET https://eliza.solasoftware.com.br/api/cron/send-reminders
Authorization: Bearer <CRON_SECRET>
```

Use timezone `America/Sao_Paulo` no agendador sempre que ele permitir.

## Fotos (biblioteca de mídia)

As fotos da biblioteca ficam em disco, fora do banco e fora do container. O banco guarda só o
metadado (texto alternativo, cor, quem enviou). Contrato `docs/contratos/midia-vitrine/`.

- **Pasta na VPS:** `/opt/stacks/solasoftware/sola-media`. Criar **antes do primeiro `up`**, porque o volume é montado no start:

  ```bash
  sudo mkdir -p /opt/stacks/solasoftware/sola-media && sudo chmod 755 /opt/stacks/solasoftware/sola-media
  ```

  O `elisa-app` grava nela, montada em `/data/media` (volume em `web/docker-compose.yaml`).
- **Container `eliza-media`:** nginx 1.27 (alpine), só leitura, sem acesso ao banco nem à `evo_net`.
  Serve a pasta em `https://eliza.solasoftware.com.br/media/...`. O Traefik manda para ele só o caminho
  `/media/` (prioridade 100). A configuração está em `web/infra/media-nginx.conf`: aceita apenas
  `<uuid>/960.webp` e `<uuid>/480.webp`, e o resto responde 404.
- **Variáveis:** `MEDIA_DIR` (vem do compose, `/data/media`) e `MEDIA_PUBLIC_BASE` (padrão
  `${NEXT_PUBLIC_APP_URL}/media`, sem barra no fim). Não precisam estar no `.env` para produção.
- **Limpeza mensal:** excluir uma foto é lógico, e os arquivos só saem do disco 30 dias depois. Rodar à mão
  uma vez por mês. Sem argumento, o script só lista. Com `--aplicar`, apaga:

  ```bash
  docker exec elisa-app node scripts/limpar-midia.mjs            # lista
  docker exec elisa-app node scripts/limpar-midia.mjs --aplicar  # apaga o que passou dos 30 dias
  ```

- **Backup: ainda não feito (risco aceito).** A pasta existe só na VPS. Se o disco for perdido, as fotos
  somem e a dona reenvia. Para a escala atual (uma org, ~20 fotos), é aceito. **Tarefa aberta:** `rsync`
  diário de `/opt/stacks/solasoftware/sola-media` para o destino de backup que for definido para a VPS (contrato
  `midia-vitrine/06-infra-e-deploy.md` §5).

## Pós-Deploy

1. Abrir `/login`.
2. Validar login.
3. Validar `/dashboard`.
4. Validar `/marcar/[slug]`.
5. Validar recuperação de senha.
   - solicitar link em `/reset-password`;
   - confirmar callback;
   - definir senha em `/update-password`;
   - entrar novamente em `/login`.
6. Validar QR Code e status do WhatsApp.
7. Rodar chamada manual do cron com `curl`.
