# API pública do Eliza (`/api/public/v1`)

Rotas **sem autenticação e somente leitura**, para sites estáticos dos clientes
(landing pages) que não podem carregar API key. Devolvem só o que já é público
em `/marcar/[slug]`. Não confundir com a [API v1](API.md) (API key por tenant)
nem com a [API de Autoatendimento](API_AUTOATENDIMENTO.md) (token + ticket).

Primeiro consumidor: LP da Deborah (`SolaSoftware/clientes/deborah/lp`,
`docs/ELIZA_CATALOGO.md`).

## `GET /api/public/v1/orgs/{slug}/catalogo`

Serviços ativos da organização, pela mesma função da página pública
(`listarServicosAtivos`, `lib/domain/catalogo.ts`). Contrato Zod estrito em
`web/contracts/publico/catalogo.ts`: campo novo na resposta vira 500, nunca
vazamento.

```json
{
  "data": {
    "organizacao": { "nome": "Clínica Admin", "slug": "admin" },
    "servicos": [
      {
        "id": "c6c3cf27-996e-465e-8262-ae698d75d776",
        "nome": "Nail Art Premium",
        "descricao": null,
        "duracaoMinutos": 60,
        "preco": 120,
        "categoria": null
      }
    ],
    "atualizadoEm": "2026-10-19T14:06:43.454Z"
  }
}
```

| Campo | Regra |
|---|---|
| `servicos[]` | Só `is_active = true` da org, ordenados por título, no máximo 30 |
| `preco` | Reais; `null` = não divulgar; `0` continua `0` |
| `categoria` | Sempre `null` até existir `services.category` (decisão D2 da LP) |
| `atualizadoEm` | Instante da consulta (`services` não tem `updated_at`) |

Erros no envelope único (`contracts/comum/envelope.ts`): `404 NOT_FOUND`
(slug inexistente ou mal formado, mesma resposta: não dá para enumerar orgs),
`429 RATE_LIMITED` com `Retry-After`, `500 INTERNAL_ERROR`.

Comportamento:

- **CORS** só para as origens de `LP_PUBLIC_ORIGINS` (lista separada por
  vírgula, origem exata, nunca `*`). Origem fora da lista recebe a resposta sem
  `Access-Control-Allow-Origin` e o navegador bloqueia a leitura. `OPTIONS` → 204.
- **Cache:** `public, max-age=30, stale-while-revalidate=300` + `ETag` do
  conteúdo (`If-None-Match` igual → `304`).
- **Limite:** 120 req/min por IP (hash com `DEMO_RATE_LIMIT_SALT`, contador
  `consume_demo_rate_limit`, prefixo `lpcat`). Falha do contador nega.
- Sem cookie, sem sessão, sem auditoria: nada de IP ou user-agent persistido.
  O `middleware.ts` não roda em `/api/public`.

```bash
curl -i https://eliza.solasoftware.com.br/api/public/v1/orgs/admin/catalogo -H "Origin: https://<dominio-da-lp>"
```

## Deep link de agendamento

`/marcar/{slug}?servico={id}` abre a página pública com o serviço já
selecionado. Id que não for serviço ativo da org é ignorado (abre sem seleção).

## Ambiente

| Variável | Onde | Exemplo |
|---|---|---|
| `LP_PUBLIC_ORIGINS` | `.env` da VPS (`/opt/eliza`) e `web/.env.local` | `https://deborahpereira.com.br,https://www.deborahpereira.com.br` (dev: `http://localhost:3200`) |

Novo cliente com LP = cadastrar a org, acrescentar o domínio dele em
`LP_PUBLIC_ORIGINS` e recriar o container.
