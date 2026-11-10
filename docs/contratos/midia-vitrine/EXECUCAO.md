# Execução — distribuição de funções, fases e portões

> Contrato: [README.md](README.md) · Escrito em 2026-11-09 (Opus)

## 1. Papéis

| Quem | Faz | Não faz |
|---|---|---|
| **Opus** (arquiteto/supervisor) | Contratos; quebra em passos; despacha os agentes com o recorte exato do contrato; revisa cada fase contra o contrato (diff + aceite rodado, não lido); decide o que o contrato não cobre e registra; checklist de deploy; conversa com o Sérgio | Código de feature (só correções pontuais na revisão) |
| **Sonnet** (código pesado) | Migration, domínio, rotas, telas, LP. Segue o contrato à letra; onde o código contradiz o contrato, para e registra no relatório | Decidir regra, mudar contrato, push/PR, deploy |
| **Haiku** (ajustes e consultas) | Tipos regenerados, conferência de privilégios, arquivos de infra copiados do contrato, docs de consumo, CHANGELOG, rodar scripts de verificação e `curl`, consultas rápidas no código para o Opus ou o Sonnet ("onde fica X", "quem chama Y") | Lógica de domínio, telas |
| **Fable** (opcional, chamado pelo Opus) | Segunda leitura **adversarial** da rota de upload (F1) e revisão do fluxo no celular (F2) | Implementar |
| **Sérgio** | Decisões de regra; comandos na VPS; aceite com a Deborah; número de versão no lançamento | — |

Os agentes rodam como **subagentes desta sessão** (ferramenta Agent, `model: sonnet | haiku | fable`), para
que a revisão do Opus fique no mesmo lugar. Cada despacho leva: o arquivo e as seções do contrato, a branch,
o que é "pronto" (os itens de aceite daquele passo) e a regra de commit. Nenhum agente faz push.

## 2. Branches e commits

- **Eliza:** `feat/midia-vitrine`, a partir da `main` atualizada. Se o contrato 11 (`feat/agenda-visivel`)
  ainda não estiver na `main`, o Opus confere antes de abrir a branch, porque a numeração das migrations e o
  CHANGELOG não podem colidir.
- **LP da Deborah:** `feat/fotos-eliza`, a partir da `main` (a LP já está em produção: v1.0.0).
- Um commit por passo, no padrão do `CLAUDE.md` global: `feat(midia): ...` / `feat(vitrine): ...` /
  `feat(lp): ...`, com `Changelog: [Não publicado] › Adicionado` e o trailer de coautoria.
- Relatórios: `Eliza/docs/RELATORIO_MIDIA_VITRINE.md` (F1, F2, F4) e `lp/docs/RELATORIO_FOTOS_ELIZA.md` (F3).
  Cada passo acrescenta: o que fez, desvios do contrato e por quê, aceite marcado com a evidência
  (comando + saída curta), pendências.

## 3. Fases e passos

### F1 — Base no Eliza (sequencial)

| Passo | Quem | Entrega | Contrato | Pronto quando |
|---|---|---|---|---|
| 1.1 | Sonnet | Migration única (`org_media`, `service_categories` + `renomear_categoria`, `vitrine_items`), aplicada via MCP Supabase | 01 §2, 02 §3, 03 §2 | Aplicou sem erro; Postgres ≥ 15 conferido |
| 1.2 | Haiku | Tipos regenerados; privilégios de `anon`/`authenticated` nas 3 tabelas e na função conferidos por SQL | 01 §8, 02 §3 | Saída das consultas no relatório |
| 1.3 | Sonnet | `lib/midia/*` (armazenamento, processar, planos), `exigirGestorDaOrg`, `MEDIA_LIMIT_REACHED`, `contracts/painel/midia.ts`, `POST /api/painel/midia`, `lib/domain/midia.ts`, actions, `scripts/limpar-midia.mjs`, `sharp` no `package.json` | 01 inteiro | Aceite 01 rodado no dev |
| 1.4 | Sonnet | `lib/domain/categorias.ts`, `lib/domain/vitrine.ts`, actions | 02 §4–5, 03 §3–4 | Aceites 02 e 03 (por script ou chamada às actions) |
| 1.5 | Sonnet | Zod + rota pública + `verificar-api-publica.mjs` | 04 §2, §3, §5 | Aceite 04 |
| 1.6 | Haiku | `web/infra/media-nginx.conf` e o `docker-compose.yaml` (copiados do 06 §3–4); `.gitignore` (`public/media`); `.env.example` (`MEDIA_DIR`, `MEDIA_PUBLIC_BASE`); `docs/API_PUBLICA.md` (04 §4); `docs/DEPLOY.md` (pasta, nginx, limpeza mensal, backup aberto); CHANGELOG | 04 §4, 06 | `docker compose config` válido |
| R1 | **Opus** (+ Fable na rota de upload) | Revisão F1: diff × contrato, aceites 01–04 reexecutados, `tsc --noEmit`, `docker compose build` com `sharp` carregando | — | Aprovado ou lista de correções devolvida ao Sonnet |

### F2 e F3 — em paralelo, depois do R1

São repositórios diferentes e só dependem do formato da API (fechado no R1).

| Passo | Quem | Entrega | Contrato | Pronto quando |
|---|---|---|---|---|
| 2.1 | Sonnet A | `MediaPicker` com recorte e envio com progresso | 05 §1, §4 | Envio + escolha funcionando a 375 px |
| 2.2 | Sonnet A | Seção "Categorias e fotos" em Serviços | 05 §2 | Itens do aceite 05 da seção |
| 2.3 | Sonnet A | Página Vitrine + item de menu | 05 §3 | Itens do aceite 05 da vitrine |
| 2.4 | Haiku | Conferir que o chunk do crop não está no JS inicial; login de `professional` sem menu/seção | 05 §5 | Evidência no relatório |
| 3.1 | Sonnet B | `catalog-core.mjs` + testes + `live-catalog.ts` | LP spec §1–2 | Testes passando, com fixture JSON com fotos (não depende do Eliza local) |
| 3.2 | Sonnet B | `Photo`, `ServiceIslands`, `GaleriaViva` + `Carousel3D`, preconnect, `site.ts` | LP spec §3–7 | Aceite da LP com a fixture |
| 3.3 | Haiku | CHANGELOG da LP; Lighthouse mobile e contagem de requisições | LP spec, aceite | Números no relatório |
| R2 | **Opus** (+ Fable no fluxo do celular) | Revisão F2 + F3; teste ponta a ponta: Eliza local (F1+F2) → LP local trocando foto sem rebuild | — | Aprovado |

### F4 — Deploy e aceite

Segue a tabela de [06 §6](06-infra-e-deploy.md). O Sérgio roda os comandos na VPS; o Haiku confere com `curl`
e o script; o Opus acompanha e decide se segue. Depois do passo 7, a carga inicial da Deborah: as 6 fotos
atuais das ilhas e as 12 da galeria sobem **pelo painel** (é o próprio teste do fluxo), pelo Sérgio ou pela
Deborah. Com isso, no primeiro dia ela já tem as fotos de hoje para "voltar atrás".

Lançamento: Eliza MENOR e LP MENOR, número confirmado com o Sérgio (06 §7). Tag, PR e merge são do Sérgio.

## 4. Modelo de despacho (Opus → agente)

```
Contexto: contrato Eliza/docs/contratos/midia-vitrine/<arquivo>.md, seções <§>. Leia README.md (regras
que não se negociam) e a seção inteira antes de começar.
Branch: <branch> (já criada). Não faça push nem PR.
Tarefa: passo <n> — <entrega>.
Pronto quando: <itens de aceite>, cada um com a evidência no relatório <arquivo>.
Se o código contradisser o contrato: pare naquele ponto, registre no relatório e devolva a pergunta.
Commit: um, no padrão do CLAUDE.md global, com "Changelog: [Não publicado] › Adicionado".
Devolva: hash do commit, desvios, pendências, e o que você não conseguiu verificar.
```

## 5. Riscos que o Opus vigia na revisão

| Risco | Onde | Como pegar |
|---|---|---|
| Foto de outra org referenciada | domínio + FK composta | Teste com 2 orgs no dev; `insert` cruzado por SQL tem de falhar |
| Arquivo gravado sem passar pelo sharp | rota de upload | Ler o caminho do buffer até `gravarVariantes`; nenhum `writeFile` fora de `armazenamento.ts` |
| `sharp` não carregar no alpine | Dockerfile | `docker compose build` + `node -e "require('sharp')"` no R1 |
| Volume esquecido no compose | 06 §3 | Upload em produção + rebuild + a foto continua lá (passo 7 do deploy) |
| Troca de foto não chegar na LP | `signature` da LP | Aceite da LP: trocar no painel, recarregar |
| CLS na LP | `Photo` remoto sem `width`/`height` | Lighthouse no 3.3 |
| Bundle do painel inchado | `react-easy-crop` | Passo 2.4 |
