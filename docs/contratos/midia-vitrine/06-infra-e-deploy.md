# 06 — Infra (pasta, nginx, Traefik) e deploy

> **TO-BE** · Fases F1 (arquivos de infra no repo) e F4 (VPS) · executor: Sonnet (arquivos), Sérgio (VPS), Haiku (conferências) · revisão: Opus

## 1. AS-IS

- VPS da Sola `srv1394604`. Eliza em `/opt/stacks/solasoftware/eliza/web`, `docker compose up -d --build`, container `elisa-app`
  (root, porta 3000), redes externas `proxy_net` e `evo_net`, router Traefik `Host(${DNS})`.
- TLS e redirect são globais no Traefik (padrão Sola): o router só declara rule e porta.
- LP da Deborah em `/opt/stacks/solasoftware/lp-deborah`, atrás do Cloudflare.

## 2. Pasta

```
/opt/stacks/solasoftware/sola-media/   root:root 755 — fora de qualquer repo, sobrevive a rebuild e a git clean
  <uuid>/960.webp
  <uuid>/480.webp
```

Um diretório para **todas** as orgs: o uuid já isola, e o banco diz de quem é cada um.

## 3. `web/docker-compose.yaml`

No serviço `elisa-app`, acrescentar:

```yaml
    volumes:
      - /opt/stacks/solasoftware/sola-media:/data/media
    environment:
      MEDIA_DIR: /data/media
```

(`MEDIA_PUBLIC_BASE` fica no padrão `${NEXT_PUBLIC_APP_URL}/media`. Pôr no `.env` só se for mudar.)

Serviço novo:

```yaml
  eliza-media:
    container_name: eliza-media
    image: nginx:1.27-alpine
    restart: always
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
    volumes:
      - /opt/stacks/solasoftware/sola-media:/srv/media:ro
      - ./infra/media-nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      proxy_net: {}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.eliza-media.rule=Host(`${DNS}`) && PathPrefix(`/media/`)"
      - "traefik.http.routers.eliza-media.priority=100"
      - "traefik.http.services.eliza-media.loadbalancer.server.port=80"
```

A `priority=100` vence o router do `elisa-app`, que tem só `Host` (prioridade = tamanho da regra, bem menor).
Esse container não tem acesso ao banco nem à `evo_net`.

## 4. `web/infra/media-nginx.conf`

```nginx
server {
  listen 80;
  server_tokens off;
  root /srv;

  location /media/ {
    # só <uuid>/<960|480>.webp; o resto é 404 (sem listagem, sem outros tipos)
    location ~ "^/media/[0-9a-f-]{36}/(960|480)\.webp$" {
      types { image/webp webp; }
      add_header Cache-Control "public, max-age=31536000, immutable" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header Cross-Origin-Resource-Policy "cross-origin" always;
      access_log off;
      try_files $uri =404;
    }
    return 404;
  }

  location / { return 404; }
}
```

`Cross-Origin-Resource-Policy: cross-origin` deixa a LP (outra origem) exibir a foto. Não há
`Access-Control-Allow-Origin`, porque `<img>` não precisa.

**Dev local:** sem nginx. `MEDIA_DIR` cai em `web/.media` (no `.gitignore`), e a rota
`app/media/[id]/[arquivo]/route.ts` serve os arquivos em `http://localhost:<porta>/media/...` (o Next não serve
com confiança arquivo criado em runtime em `public/`). Em produção essa rota responde sempre 404. Em produção esse caminho nunca chega ao Next (Traefik).

## 5. Backup (risco aceito, tarefa aberta)

Hoje não há backup fora da VPS. Se o disco for perdido, as fotos somem, mas a LP cai para as fotos locais
(F3) e a dona reenvia. Para a escala atual (uma org com ~20 fotos), aceito. **Tarefa aberta**, fora deste
contrato: `rsync` diário de `/opt/stacks/solasoftware/sola-media` para o destino de backup que for definido para a VPS.
Registrar em `docs/DEPLOY.md`.

## 6. Ordem de deploy (F4)

Cada passo só depois do anterior conferido.

| # | Passo | Quem | Conferência |
|---|---|---|---|
| 1 | Migration via MCP Supabase (aditiva: tabelas novas, nada lido pelo código antigo) | Sonnet na F1, ou Opus no deploy se a F1 rodou só local | Haiku: `list_tables` + privilégios de `anon` |
| 2 | `sudo mkdir -p /opt/stacks/solasoftware/sola-media && sudo chmod 755 /opt/stacks/solasoftware/sola-media` | Sérgio | `ls -ld` |
| 3 | `cd /opt/stacks/solasoftware/eliza && sudo git pull` (conferir `git log -1` = commit esperado: armadilha de 03/11) | Sérgio | hash |
| 4 | `cd web && sudo docker compose up -d --build` (sobe `elisa-app` com volume e `eliza-media`) | Sérgio | `docker compose ps` com os dois `Up` |
| 5 | `docker exec elisa-app node -e "require('sharp')"` | Sérgio | sem erro |
| 6 | `curl -sI https://eliza.solasoftware.com.br/media/00000000-0000-0000-0000-000000000000/960.webp` → 404 **do nginx** (`server` sem versão) e `curl -sI https://eliza.solasoftware.com.br/` → 200 do app | Haiku | cabeçalhos |
| 7 | Envio de teste pela org `admin` em produção; `HEAD` na URL devolvida | Opus/Haiku | 200 `image/webp` `immutable` |
| 8 | `node web/scripts/verificar-api-publica.mjs https://eliza.solasoftware.com.br deborah-pereira https://deborahpereiranails.com.br` | Haiku | passa |
| 9 | Deploy da LP (F3) — `lp-deborah`, `git log -1`, `deploy.sh` | Sérgio | smoke da LP |
| 10 | Aceite com a Deborah (README, aceite geral), no celular dela | Sérgio + Deborah | lista |

Se o domínio do Eliza estiver atrás do Cloudflare, o `immutable` também vale na borda, e `.webp` já entra no
cache padrão dele. Conferir no passo 6 (`cf-cache-status` na segunda chamada) e registrar.

## 7. Versões e changelog

- Eliza: item em `## [Não publicado]` › **Adicionado** (biblioteca de fotos, foto e ordem de categoria,
  vitrine, campos novos no catálogo público) já no commit de cada fase. Lançamento = **MENOR** (aditivo).
  Número confirmado com o Sérgio na hora.
- LP da Deborah: **Adicionado** (fotos, ordem e vitrine vindas do Eliza). Lançamento = **MENOR** (1.1.0).
