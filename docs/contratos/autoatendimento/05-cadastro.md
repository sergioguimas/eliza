# 05 — Cadastro do próprio cliente

> TO-BE · Contrato v1 · Zod: `cadastro.ts` · ver [README](README.md)

O cliente só lê e altera **o próprio** cadastro, identificado pelo telefone do
ticket. Não existe busca de cadastro por nome, documento ou outro telefone.

## `GET /cadastro`

Exige `identificado`. Devolve `Cadastro`:

- `documentoMascarado`: CPF com 11 dígitos → `***.***.XXX-YY` (últimos 5
  dígitos visíveis). Qualquer outro formato → só os últimos 4, prefixados por
  `***`. `null` se vazio.
- `email`: completo. É do próprio cliente.
- `dataNascimentoInformada`: `birth_date is not null`. A data em si não sai.

Nunca devolver `address`, `notes`, `gender` nem `document` completo.

## `POST /cadastro` — criar

Só quando `identificacao = desconhecido`. `identificado` →
`CUSTOMER_CONFLICT`; `ambiguo` → `CUSTOMER_AMBIGUOUS`.

1. `aa-escrita`.
2. Normalizar `documento` com a mesma regra do trigger
   `trg_normalize_customer_fields` (`[^0-9A-Za-z]` removido) só para a busca
   prévia; o trigger preenche `document_normalized` na gravação. Se já existe
   cliente na org com esse documento
   (`uq_customers_org_document`), responder `CUSTOMER_CONFLICT` **sem**
   vincular nem atualizar esse cadastro. O documento pode ser de outra pessoa,
   e o vínculo telefone ↔ cadastro existente é decisão da equipe. O atendente
   escala.
3. Inserir em `customers`: `organization_id` do ticket; `phone` = telefone do
   ticket normalizado com `55` na frente, como faz o fluxo público;
   `name`, `document`, `email`, `birth_date`; `active = true`.
4. Resposta 201 com `Cadastro`.

Documento obrigatório para ficar igual à página pública, que já exige nome,
telefone e documento.

## `PATCH /cadastro`

Exige `identificado`. Body `AtualizarCadastroBody` (pelo menos um campo).

- `nome`, `email`, `dataNascimento`: sobrescrevem.
- `documento`: aceito **só se o cadastro ainda não tem documento**. Se já tem,
  `INVALID_TRANSITION`, mesmo que o valor seja igual. Trocar documento por
  WhatsApp é o caminho de apropriação de cadastro alheio. Conflito com o
  documento de outro cliente → `CUSTOMER_CONFLICT`.
- Telefone **não** se altera por aqui. Mudou de número? A equipe resolve.
- `updated_at = now()`.

## Por que não usar `find_or_create_public_customer`

A RPC existente procura por documento, depois por telefone, e **atualiza** o
que achar com o que veio. Para um canal que recebe texto livre de qualquer
pessoa, isso faz um "meu CPF é X" sobrescrever o nome de quem tem o CPF X.
Aqui criar e atualizar são operações separadas, com as travas acima.

## Aceite

- [ ] `desconhecido` cria → 201; um `GET /contexto` seguinte vem `identificado`.
- [ ] `identificado` tentando criar → 409 `CUSTOMER_CONFLICT`.
- [ ] Criar com documento de outro cliente da org → 409, e o outro cadastro fica intacto.
- [ ] `PATCH` de documento quando já existe um → 409, sem alterar.
- [ ] `PATCH {}` → 422.
- [ ] `GET` nunca devolve endereço, observações nem documento completo.
- [ ] Body com `telefone` → 422 (`.strict()`).
