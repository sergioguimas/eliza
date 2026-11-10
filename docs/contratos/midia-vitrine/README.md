# Mídia, categorias com foto e vitrine — contrato

> **TO-BE** · nada implementado · relatório da execução: `docs/RELATORIO_MIDIA_VITRINE.md`
> **Escrito em:** 2026-11-09 (Opus) · **Origem:** pedido da Deborah de trocar sozinha as fotos da LP
> (ilhas de serviço e destaques), sem chamar o Sérgio a cada troca.
> **Zod tocados:** `web/contracts/publico/catalogo.ts` (aditivo) e o novo `web/contracts/painel/midia.ts`
> **Consumidor de referência:** LP da Deborah, `SolaSoftware/clientes/deborah/lp/docs/FOTOS_DO_ELIZA.md`

## O que é

A dona do negócio (ou um admin) sobe fotos no painel do Eliza, escolhe a foto de cada **categoria** de
serviço, ordena as categorias e monta uma **vitrine** (destaques do trabalho). Os sites dos clientes leem
tudo pela rota pública do catálogo, que já consultam hoje. Trocar uma foto **não reconstrói a LP**:
a página vê a mudança na próxima visita.

Os arquivos ficam numa **pasta em disco da VPS** (`/opt/stacks/solasoftware/sola-media`). O Eliza grava nela, e um nginx
pequeno serve em `https://eliza.solasoftware.com.br/media/...`. Não há bucket nem S3. O banco guarda só
metadado (texto alternativo, cor, quem subiu), **nunca os bytes**.

Isso já fica como **modelo** para as próximas páginas que a Sola oferecer como complemento: qualquer site
que lê o catálogo público ganha fotos e vitrine sem configuração nova.

## Arquivos deste contrato

| Arquivo | O que define |
|---|---|
| [01-armazenamento-e-upload.md](01-armazenamento-e-upload.md) | Biblioteca de fotos: tabela `org_media`, pasta em disco, processamento (sharp), rota de upload, exclusão |
| [02-categorias.md](02-categorias.md) | Tabela `service_categories`: foto e ordem por categoria, renomear sem quebrar os serviços |
| [03-vitrine.md](03-vitrine.md) | Tabela `vitrine_items`: destaques ordenados com legenda e categoria |
| [04-api-publica.md](04-api-publica.md) | Campos novos `categorias` e `vitrine` no catálogo público, OpenAPI e script de verificação |
| [05-painel.md](05-painel.md) | Telas: seletor de fotos com recorte, "Categorias e fotos" em Serviços, página Vitrine |
| [06-infra-e-deploy.md](06-infra-e-deploy.md) | Pasta na VPS, container nginx, Traefik, ordem de deploy, backup |
| [EXECUCAO.md](EXECUCAO.md) | Distribuição de funções (Opus, Sonnet, Haiku, Fable), fases, passos, commits e revisões |

## Para quem executa

Os `.md` dizem **o que** e **por quê**. Os Zod (escritos aqui em bloco de código; quem executa cria o
arquivo) são a forma exata. Onde o contrato der um valor fechado, use o valor. Se o código contradisser
uma premissa daqui, o código vence: pare, registre no relatório e siga o que é correto.

**Regras que não se negociam:**

1. **Bytes nunca no banco.** O Postgres guarda só metadado. Arquivo só em `MEDIA_DIR`.
2. **Nome de arquivo nunca vem do usuário.** O caminho é sempre `<MEDIA_DIR>/<uuid>/<largura>.webp`,
   com o uuid gerado pelo servidor. Nada de nome original, extensão enviada ou caminho relativo.
3. **Toda imagem é decodificada e reescrita pelo servidor** (sharp). O arquivo enviado nunca é salvo
   como veio: isso remove EXIF/GPS, script embutido e formato disfarçado.
4. **Uma org nunca enxerga nem referencia mídia de outra.** Isso vale no banco (FK composta com
   `organization_id`) e no domínio (toda função recebe `orgId` da sessão, nunca do formulário).
5. **Escrita só pelo domínio com service role**, como em `schedule_blocks`: `authenticated` só lê a
   própria org e `anon` não lê nada. Tabela nova = `REVOKE` explícito.
6. **Só `owner` e `admin` mexem em fotos, categorias e vitrine.** `professional` não vê as telas, e o
   servidor recusa com 403 mesmo que alguém chame a rota direto.
7. **A API pública é aditiva:** campos novos sempre presentes (`[]` quando vazio), nada renomeado nem
   removido. A LP antiga continua funcionando com a resposta nova.
8. **Desempenho é requisito, não acabamento:** arquivo imutável com cache de 1 ano, duas larguras fixas,
   `largura`/`altura` na resposta (zero CLS), redução de tamanho no navegador antes do envio.

## Decisões

| # | Decisão | Quem/quando | Por quê |
|---|---|---|---|
| MV1 | Arquivos em pasta na VPS, sem bucket ou S3 | Sérgio, 2026-11-09 | Não abrir infraestrutura de storage agora. A troca futura para R2/S3 mexe só em `lib/midia/armazenamento.ts`, porque o contrato devolve URL |
| MV2 | Foto e ordem moram numa tabela de categorias (`service_categories`), ligada pelo nome | Sérgio, 2026-11-09 (revê a P3 da API pública) | A ilha da LP é a categoria. Com a ordem no Eliza, o `SERVICE_ORDER` fixo da LP vira só reserva |
| MV3 | Arquivos servidos pelo domínio do Eliza (`/media/`), via nginx e Traefik por caminho | Sérgio, 2026-11-09 | Nenhuma configuração por página. O `/marcar` também pode usar. Reaproveita a conexão que a LP já abre para o catálogo |
| MV4 | `services.category` continua texto. A tabela nova guarda só metadado por **chave** (`lower(btrim(nome))`) | Opus | Mudança aditiva: formulário, as três APIs e a LP não mudam a forma de ler a categoria |
| MV5 | Uma **biblioteca** de fotos por org. Categorias e vitrine apontam para ela | Opus | "Voltar para a foto anterior" = escolher na biblioteca. Para uma cliente indecisa, isso vale mais que o upload |
| MV6 | Formato único 3:4, duas larguras: 960×1280 e 480×640, WebP q80 | Opus | É o quadro das ilhas e dos cards da galeria. Duas larguras cobrem celular e desktop com `srcset`, sem pipeline de variantes |
| MV7 | Recorte feito pela dona no navegador (3:4) e aplicado pelo servidor | Opus | Sem ponto focal para ajustar depois, e a foto deitada não quebra o layout |
| MV8 | O navegador reduz para no máximo 2560 px e envia JPEG; o servidor aceita até 8 MB | Opus | Foto de iPhone tem 4–8 MB. Reduzir antes economiza o 4G dela e resolve o HEIC (o Safari decodifica e o canvas reescreve) |
| MV9 | Cor de fundo (`cor`) calculada pelo servidor (dominante do sharp) | Opus | A galeria da LP usa `tint` por foto. Hoje é escolhido à mão; vira automático |
| MV10 | `categorias` e `vitrine` vão na **mesma** resposta do catálogo público | Opus | Uma requisição só na LP, com o mesmo ETag e o mesmo cache de 30 s. Separar dobraria as idas ao Eliza |
| MV11 | Exclusão de foto é lógica (`deleted_at`); os arquivos só saem do disco 30 dias depois, por script | Opus | Um snapshot de build antigo da LP pode apontar para a foto excluída. 30 dias cobrem qualquer rebuild |
| MV12 | Gate de plano por constante `PLANOS_COM_VITRINE = "todos"`, igual à API | Opus | Mesmo padrão de `lib/api/planos.ts`. Liberar/cobrar depois é trocar a constante |
| MV13 | Cota: 80 fotos ativas por org, 30 envios por hora por org | Opus | Uma LP usa ~20. A cota protege o disco da VPS sem incomodar ninguém |
| MV14 | Vitrine no `/marcar`: fora deste contrato (fase 3, contrato próprio) | Opus | Entregar primeiro o que a Deborah pediu. O dado já sai pronto na API |
| MV15 | Upload por **route handler** (`POST /api/painel/midia`), não server action | Opus | Server action tem limite de 1 MB por padrão. Rota com `formData` evita mexer em `serverActions.bodySizeLimit` global |

## Ordem de execução (resumo)

O detalhe, com quem faz cada passo, está em [EXECUCAO.md](EXECUCAO.md).

| Fase | Entrega | Contratos |
|---|---|---|
| F1 | Base no Eliza: migration, biblioteca + upload, categorias e vitrine no domínio, API pública, OpenAPI, verificação | 01, 02, 03, 04 |
| — | **Revisão Opus F1** | |
| F2 | Painel: seletor com recorte, "Categorias e fotos", página Vitrine | 05 |
| — | **Revisão Opus F2** (e revisão de UX no celular, opcional, com Fable) | |
| F3 | LP da Deborah lendo fotos, ordem e vitrine do Eliza | `lp/docs/FOTOS_DO_ELIZA.md` |
| — | **Revisão Opus F3** | |
| F4 | Deploy: migration → pasta e nginx na VPS → Eliza → verificação em produção → LP. Aceite com a Deborah | 06 |

## Aceite geral

- [ ] A Deborah, **pelo celular**, sobe uma foto, recorta, escreve a descrição e coloca na ilha "Alongamento".
      A LP mostra a foto nova numa visita nova, sem rebuild.
- [ ] Ela volta para a foto anterior escolhendo na biblioteca.
- [ ] Ela reordena as ilhas no Eliza e a LP segue a ordem nova.
- [ ] Ela monta a vitrine com 8 a 12 fotos, legenda e categoria, e a galeria da LP passa a ser essa.
- [ ] Um `professional` não vê as telas e recebe 403 na rota de upload.
- [ ] O Lighthouse mobile da LP continua com Perf ≥ 95 e CLS 0 (hoje: 97).
- [ ] `verificar-api-publica.mjs` passa em produção, inclusive os `HEAD` nas URLs de foto (200, `image/webp`, `immutable`).
- [ ] Com o Eliza fora do ar, a LP mostra as fotos do snapshot ou as locais, nunca imagem quebrada.

## Fora deste contrato

- Vitrine e foto de categoria no `/marcar` (MV14, fase 3).
- Foto de categoria/serviço nas APIs v1 e de Autoatendimento. Uma ideia para depois: o atendente mandar
  a foto da categoria no WhatsApp quando a cliente pergunta por um serviço.
- Backup da pasta `/opt/stacks/solasoftware/sola-media` fora da VPS (ver 06 §5: risco aceito, com tarefa aberta).
- Foto por serviço (só por categoria e vitrine).
- Vídeo, GIF, SVG.
- Migrar o storage para R2/S3.
