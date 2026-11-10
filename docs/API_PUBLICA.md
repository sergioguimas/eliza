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
        "descricao": "Inclui remoção. Decoração e extras são combinados no atendimento.",
        "duracaoMinutos": 60,
        "preco": 120,
        "precoAPartirDe": true,
        "categoria": "Nail art",
        "adicionais": [{ "id": "5b1f7d2a-3c4e-4a69-8f10-2d9e6c0a7b13", "nome": "Unha quebrada", "valor": 5, "unidade": "por unha" }]
      }
    ],
    "categorias": [
      {
        "nome": "Nail art",
        "foto": {
          "url": "https://eliza.solasoftware.com.br/media/0b7e5c2a-41d3-4f8e-9a62-3c1d7e8f9a10/960.webp",
          "urlPequena": "https://eliza.solasoftware.com.br/media/0b7e5c2a-41d3-4f8e-9a62-3c1d7e8f9a10/480.webp",
          "largura": 960,
          "altura": 1280,
          "alt": "Unhas decoradas com desenhos florais em tons pastel",
          "cor": "#e8d5c4"
        }
      }
    ],
    "vitrine": [
      {
        "id": "9d2e4b6a-1c3f-4e5a-8b7c-0a1d2e3f4b5c",
        "legenda": "Nail art com decoração floral",
        "categoria": "Nail art",
        "foto": {
          "url": "https://eliza.solasoftware.com.br/media/5a8f3d1e-2b6c-4d9a-8e7f-1c0b9a8d7e6f/960.webp",
          "urlPequena": "https://eliza.solasoftware.com.br/media/5a8f3d1e-2b6c-4d9a-8e7f-1c0b9a8d7e6f/480.webp",
          "largura": 960,
          "altura": 1280,
          "alt": "Mão com unhas longas e desenho de flores brancas",
          "cor": "#d9cfc4"
        }
      }
    ],
    "atualizadoEm": "2026-10-19T14:06:43.454Z"
  }
}
```

| Campo | Regra |
|---|---|
| `servicos[]` | Só `is_active = true` da org, ordenados por título, no máximo 30 |
| `descricao` | Observações do serviço, editadas no painel (até 500 caracteres); `null` quando vazia. É texto para o cliente final |
| `preco` | Reais; `null` = não divulgar; `0` continua `0`. Quando `precoAPartirDe` é `true`, é o valor mínimo |
| `precoAPartirDe` | `true` = preço "a partir de": o valor final depende do que o cliente pedir a mais e é combinado no atendimento. Sempre presente (`false` por padrão). Exibir como "a partir de R$ X" |
| `categoria` | Texto livre (até 40) definido no painel; `null` = sem grupo. Serviços com a mesma categoria devem ser exibidos juntos (decisão D2 da LP) |
| `adicionais` | Custos opcionais além de `preco`: `id` (estável), `nome`, `valor` (reais) e `unidade` (ex.: "por unha"; `null` = valor fixo). O cliente escolhe a quantidade ao agendar na página de agendamento e a soma entra no valor do agendamento. Até 10 por serviço. Sempre presente; `[]` quando não há |
| `categorias[]` | Categorias de serviço na ordem de exibição (definida no painel), só as usadas por serviços ativos, no máximo 30. `nome` é igual ao `categoria` dos serviços (compare com `lower` e `trim`). `foto` é a foto da categoria, ou `null` quando não há. Sempre presente; `[]` quando vazio |
| `vitrine[]` | Destaques ativos na ordem de exibição, no máximo 24. `legenda` (até 60 caracteres), `categoria` (texto, ou `null` quando não há ou a categoria deixou de existir) e `foto`. Sempre presente; `[]` quando vazia |
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

## Fotos

`categorias[].foto` e `vitrine[].foto` têm o mesmo formato. `foto` é `null` só na categoria sem foto.

| Campo | Uso |
|---|---|
| `url` | Variante grande, 960 px de largura |
| `urlPequena` | Variante pequena, 480 px de largura |
| `largura`, `altura` | Dimensões da variante grande (formato 3:4, 960 × 1280). Use em `width` e `height` do `<img>` para não deslocar o layout |
| `alt` | Texto alternativo escrito pela dona. Sempre preenchido: use no `<img>` |
| `cor` | Cor dominante (`#rrggbb`), para o fundo enquanto a foto carrega |

As fotos são WebP. Cada arquivo é **imutável**: nunca é sobrescrito, e trocar a foto gera outra URL. Por isso
a resposta pode ser guardada em cache por 1 ano (`immutable`). Trocar a foto de uma categoria muda o `ETag`
do catálogo, e a página vê a mudança na próxima leitura (até 30 s, pelo cache da resposta).

Use as duas larguras em `srcset`, com `alt`, `width` e `height`:

```html
<img
  src="https://eliza.solasoftware.com.br/media/0b7e5c2a-41d3-4f8e-9a62-3c1d7e8f9a10/960.webp"
  srcset="https://eliza.solasoftware.com.br/media/0b7e5c2a-41d3-4f8e-9a62-3c1d7e8f9a10/480.webp 480w,
          https://eliza.solasoftware.com.br/media/0b7e5c2a-41d3-4f8e-9a62-3c1d7e8f9a10/960.webp 960w"
  width="960"
  height="1280"
  alt="Unhas decoradas com desenhos florais em tons pastel"
  style="background-color: #e8d5c4"
  loading="lazy">
```

Uma foto excluída na biblioteca sai do catálogo na hora, mas o arquivo continua no ar por **30 dias**: uma
página com build antigo ainda pode apontar para ele. Depois desse prazo a URL responde 404. Por isso, o site
deve ter reserva para quando a foto não carregar (um `onerror` que troque por uma imagem do próprio site).

## Deep link de agendamento

`/marcar/{slug}?servico={id}` abre a página pública com o serviço já
selecionado. Id que não for serviço ativo da org é ignorado (abre sem seleção).

## Ambiente

| Variável | Onde | Exemplo |
|---|---|---|
| `LP_PUBLIC_ORIGINS` | `.env` da VPS (`/opt/stacks/solasoftware/eliza`) e `web/.env.local` | `https://deborahpereira.com.br,https://www.deborahpereira.com.br` (dev: `http://localhost:3200`) |

Novo cliente com LP = cadastrar a org, acrescentar o domínio dele em
`LP_PUBLIC_ORIGINS` e recriar o container.

## Documentação interativa

A spec OpenAPI 3.1 está em `/api/public/v1/openapi.json` (gerada do Zod) e aparece no Swagger
(`/api/v1/docs`) como "API pública (sites)", ao lado das outras duas.

## Verificação do contrato

`web/scripts/verificar-api-publica.mjs` (Node puro, sem dependência) confere o formato fechado da resposta,
cabeçalhos (`set-cookie`, `cache-control`, `etag`), `304`, os `404` idênticos e o CORS:

```
node web/scripts/verificar-api-publica.mjs <base-url> <slug> [origem-permitida]
node web/scripts/verificar-api-publica.mjs http://localhost:3001 admin http://localhost:3200
```

Sai com código 1 na primeira falha. A lista de campos é fechada no script: campo novo na resposta reprova até o
script ser atualizado. Não testa o `429` (gastaria a cota do IP).
