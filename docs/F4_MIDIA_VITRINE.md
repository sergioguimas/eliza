# F4 — Roteiro de deploy e aceite (mídia e vitrine)

> Contrato: [contratos/midia-vitrine/06-infra-e-deploy.md §6](contratos/midia-vitrine/06-infra-e-deploy.md) · Preparado em 2026-11-10 (Opus)

Cada passo só depois do anterior conferido. **Sérgio** roda os comandos na VPS (`srv1394604`); o **Opus/Haiku**
confere de fora com `curl` e scripts.

## 0. Antes de tocar na VPS

| # | O quê | Quem | Estado |
|---|---|---|---|
| 0.1 | Migrations no Supabase: `organization_settings_agenda_visivel` (contrato 11) e `midia_categorias_vitrine` | Opus | **feito** (conferido em `schema_migrations` em 10/11) |
| 0.2 | Lançamento: Eliza **1.4.0** (inclui a agenda visível do PR #67, que está na `main` sem versão), LP **1.1.0**. Commit `chore(release)` em cada branch | Opus, número confirmado pelo Sérgio | pendente |
| 0.3 | Push de `feat/midia-vitrine` (Eliza) e `feat/fotos-eliza` (LP) + PR para a `main` em cada repo | Opus, com o ok do Sérgio | pendente |
| 0.4 | Merge dos dois PRs (merge commit, sem squash, para o commit de release manter o hash) e tags `v1.4.0` / `v1.1.0` no commit de release | Sérgio | pendente |

A agenda visível sobe junto neste deploy. A migration dela já está aplicada, e o código antigo não lê a coluna nova.

## 1. Eliza

```bash
# 1. Conferir o .env (sem isso todo envio de foto leva 403 pela checagem de origem)
grep -E '^(NEXT_PUBLIC_APP_URL|LP_PUBLIC_ORIGINS|DNS)=' /opt/eliza/web/.env
#    esperado: NEXT_PUBLIC_APP_URL=https://eliza.solasoftware.com.br
#              LP_PUBLIC_ORIGINS com https://deborahpereiranails.com.br (e o www, se houver)
#              DNS=eliza.solasoftware.com.br
#    MEDIA_DIR e MEDIA_PUBLIC_BASE NÃO precisam estar no .env (vêm do compose / do padrão).

# 2. Pasta das fotos (antes do primeiro up: o volume é montado no start)
sudo mkdir -p /opt/stacks/solasoftware/sola-media && sudo chmod 755 /opt/stacks/solasoftware/sola-media && ls -ld /opt/stacks/solasoftware/sola-media

# 3. Código
cd /opt/eliza && sudo git pull && git log -1 --oneline
#    o hash tem de ser o merge do PR (armadilha de 03/11: pull que não trouxe nada)

# 4. Subir (rebuild do elisa-app + container novo eliza-media)
cd web && sudo docker compose up -d --build && sudo docker compose ps
#    esperado: elisa-app e eliza-media "Up"

# 5. sharp carrega no alpine
sudo docker exec elisa-app node -e "const s=require('sharp');console.log('sharp',s.versions.sharp)"
```

Se o passo 4 falhar no build, o container antigo continua no ar: nada a desfazer. Se subir e der problema,
voltar: `cd /opt/eliza && sudo git checkout <hash anterior> && cd web && sudo docker compose up -d --build`.
As tabelas novas não atrapalham o código antigo.

**Conferência de fora (Opus/Haiku), depois do passo 5:**

| # | Checagem | Esperado |
|---|---|---|
| 6a | `curl -sI https://eliza.solasoftware.com.br/media/00000000-0000-0000-0000-000000000000/960.webp` | 404 vindo do **nginx** (`Server: nginx`, sem versão; hoje vem do Next em HTML) |
| 6b | `curl -sI https://eliza.solasoftware.com.br/` | 200 do app |
| 6c | `curl -s https://eliza.solasoftware.com.br/api/public/v1/orgs/deborah-pereira/catalogo` | traz `categorias` e `vitrine` |
| 8 | `node web/scripts/verificar-api-publica.mjs https://eliza.solasoftware.com.br deborah-pereira https://deborahpereiranails.com.br` | passa |

**7. Envio de teste em produção (org `admin`):** o Sérgio entra no painel de produção, envia uma foto
em Serviços › Categorias e fotos. Conferir:
- `sudo ls /opt/stacks/solasoftware/sola-media` mostra a pasta `<uuid>` (prova de que o volume está montado e a foto sobrevive a rebuild);
- `HEAD` na URL da foto → 200 `image/webp`, `Cache-Control: ... immutable`.
- Depois o Opus apaga esse registro de teste.

## 2. LP da Deborah

Só depois do Eliza conferido. A LP atual (1.0.0) ignora os campos novos, então a ordem não tem risco.

```bash
cd /opt/stacks/solasoftware/lp-deborah && sudo git pull && git log -1 --oneline && sudo sh infrastructure/deploy.sh
```

Conferência (Opus): `npm run smoke -- https://deborahpereiranails.com.br --both` e uma olhada a 375 px. Enquanto
a org `deborah-pereira` não tiver fotos, a página fica **idêntica** à de hoje (fallback local); isso é o esperado.

Voltar, se preciso: `sudo git checkout v1.0.0 && sudo sh infrastructure/deploy.sh`.

## 3. Carga inicial e aceite

1. **Carga pelo painel**, na org `deborah-pereira` (é o próprio teste do fluxo): a foto de cada uma das 6 ilhas
   (as mesmas de hoje, de `lp/public/fotos/servicos/` e `lp/public/fotos/`) e as 12 da galeria na Vitrine. Assim
   ela já começa com as fotos atuais para "voltar atrás". A ordem das categorias no painel = ordem das ilhas
   (hoje: a de `SERVICE_ORDER` em `lp/src/lib/site.ts`).
2. A galeria só passa a vir do Eliza quando a Vitrine tiver **4 fotos ou mais**.
3. **Aceite com a Deborah, no celular dela:** trocar a foto de uma ilha, mudar a ordem, adicionar e esconder uma
   foto da vitrine, e ver cada troca no site ao recarregar.
4. Fora do aceite, ainda aberto: login de `professional` (não vê menu, seção nem página) e o backup diário de
   `/opt/stacks/solasoftware/sola-media` (risco aceito, 06 §5).
