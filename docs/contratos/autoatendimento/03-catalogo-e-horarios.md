# 03 — Catálogo e horários livres

> TO-BE · Contrato v1 · Zod: `catalogo.ts` · ver [README](README.md)

Estes três endpoints não exigem cliente identificado: um desconhecido pode
perguntar preço e horário antes de se cadastrar, como na página pública.

## Catálogo

`listarServicosAtivos` / `listarProfissionaisAtivos` de
[00-dominio §3](../00-dominio/README.md). Profissional nunca expõe `phone` nem
`license_number`. `preco`: `null` se `price` for nulo; preço 0 continua 0.

`GET /servicos` e `GET /profissionais`: sem query; devolvem as listas.

**Não existe vínculo serviço ↔ profissional no schema.** Todo profissional
ativo é tratado como apto a todo serviço, como a página pública já faz hoje.
Não inventar o vínculo; se for preciso, é decisão de produto.

## Horários

`listarHorariosLivres` de [00-dominio §4](../00-dominio/README.md), com a
duração do serviço e `naoAntesDe = agora + antecedenciaMinimaMinutos`. A
correção da janela pela duração do serviço, o corte de horário passado e o
`ignorarAgendamentoId` estão lá. Se a lista sair vazia só pelo corte,
`motivoVazio = "antecedencia_minima"`.

## `GET /api/v1/autoatendimento/horarios`

Query validada por `HorariosQuery`: `servicoId`, `data` e `profissionalId`
opcional.

1. O serviço precisa ser ativo e da org do ticket. Se não for, `NOT_FOUND`.
2. Se veio `profissionalId`, ele precisa ser ativo e da org (`NOT_FOUND`).
   Sem ele, usar todos os ativos.
3. `data` < hoje local, ou > hoje + `janelaMaximaDias` → `OUT_OF_WINDOW`.
4. Para cada profissional: `listarHorariosLivres` com a duração do serviço
   e `naoAntesDe = agora + antecedenciaMinimaMinutos`.
5. `porProfissional` na ordem de `listarProfissionaisAtivos`, **incluindo** quem
   ficou sem horário (com `motivoVazio`), para o atendente poder dizer "com a
   Dra. X não há, com o Dr. Y há".

## Aceite

- [ ] `/marcar/[slug]` mostra os mesmos serviços e profissionais de antes.
- [ ] Na página pública, serviço com a mesma duração da org → mesmos horários
      de antes, exceto os já passados hoje.
- [ ] Serviço de 60 min, org com 30 min e almoço 12–13: 11:30 **não** aparece;
      11:00 aparece.
- [ ] `servicoId` de outra org → 404.
- [ ] `data` de ontem e `data` além da janela → 422 `OUT_OF_WINDOW`.
- [ ] Hoje às 16:10 com antecedência de 120 min: primeiro horário ≥ 18:10.
- [ ] Profissional sem expediente no dia aparece com `horarios: []` e motivo.
- [ ] Resposta não contém telefone nem registro do profissional.
