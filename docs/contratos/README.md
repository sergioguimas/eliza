# Contratos do Eliza

Esteira: **regra (Sérgio) → contrato (Opus) → código (Sonnet) → revisão (Opus)**.
Os `.md` dizem o quê e por quê; os Zod em `web/contracts/` dizem a forma.
Se discordarem, Zod vence para forma e `.md` para regra; registre a divergência.

| Pasta | Tipo | O que é |
|---|---|---|
| [DECISOES_API.md](DECISOES_API.md) | — | Decisões D1–D8 de 2026-10-06 (unificação das APIs, regra de status) |
| [00-dominio/](00-dominio/README.md) | TO-BE | `web/lib/domain/`: regra de agendamento compartilhada por painel, página pública e as duas APIs |
| [api-v1/](api-v1/README.md) | AS-IS + TO-BE | API REST B2B com API key por tenant (`a0ff88a`) e as correções |
| [autoatendimento/](autoatendimento/README.md) | TO-BE | API do cliente final (bot), revisada em 2026-10-06 |

Zod: `web/contracts/comum/envelope.ts` (envelope e erros únicos),
`web/contracts/api-v1/`, `web/contracts/autoatendimento/`.

## Ordem de execução

Um passo por vez; cada um termina com painel, página pública e API v1
funcionando. Cada contrato tem a sua ordem interna e o seu Aceite.

| # | Etapa | Contrato | Relatório |
|---|---|---|---|
| 1 | Domínio: tempo, catálogo, horários | 00-dominio §10 passos 1–2 | `docs/RELATORIO_DOMINIO.md` |
| 2 | Domínio: status, clientes, agendamentos; actions do painel apontadas | 00-dominio §10 passos 3–4 | idem |
| 3 | Rotas v1 no domínio; `lib/api/domain` apagado | 00-dominio passo 5 + api-v1 §8 passos 1–4 | `docs/RELATORIO_API_V1.md` |
| 4 | v1: escopo `payments`, gate de plano, tipos, `docs/API.md` | api-v1 §8 passos 5–8 | idem |
| — | **Revisão Opus** da leva 1–4 → merge na `main` → deploy | | |
| 5 | Autoatendimento F0 | autoatendimento §7 | `docs/RELATORIO_AUTOATENDIMENTO_F0.md` |

Antes da etapa 2: incorporar o resultado de `docs/AUDITORIA_STATUS_PAINEL.md`
(conferência paralela de 2026-10-06) à tabela §8 do 00-dominio.

**Branch:** `development`. Nada vai para a `main` antes da revisão. O commit
`a0ff88a` (v1 sem contrato) já está na `development` e não está em produção.
