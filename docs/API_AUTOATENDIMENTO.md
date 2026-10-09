# API de Autoatendimento do Eliza (`/api/v1/autoatendimento`)

Guia para quem desenvolve o **atendente de WhatsApp** (`eliza-atendente`) e precisa consumir esta API.
Não é a API para o tenant integrar o próprio sistema (essa é a [API v1](API.md)).

Referência exata de cada rota, com exemplos e erros: Swagger em `/api/v1/docs` (seletor "Autoatendimento") ou
`/api/v1/autoatendimento/openapi.json`. Este guia explica o **como usar**; a forma dos campos é a do Swagger.
Regras de produto por trás: `docs/contratos/autoatendimento/`.

## 1. O modelo em uma tela

O Eliza não tem LLM nem lógica de conversa. Ele recebe a mensagem do WhatsApp, **encaminha** ao atendente com um
**ticket**, e o atendente responde chamando esta API, que age **somente** sobre quem escreveu.

```
cliente ──WhatsApp──▶ Eliza ──POST {ATENDENTE_URL}/v1/mensagens (ticket + texto)──▶ atendente
                                                                                       │
cliente ◀─WhatsApp── Eliza ◀── POST /api/v1/autoatendimento/mensagens ◀───────────────┘
                       ▲        GET /contexto, /horarios · POST /agendamentos ...
```

O atendente **não** tem a chave da Evolution nem acesso ao banco. Tudo que ele faz passa por aqui.

## 2. Autenticação: duas camadas, três headers

Toda chamada leva os três:

```http
Authorization: Bearer <AUTOATENDIMENTO_API_TOKEN>
X-Autoatendimento-Ticket: <ticket da mensagem mais recente>
X-Autoatendimento-Versao: 1
```

| Camada | O que prova | Falha |
|---|---|---|
| Token de serviço | Que quem chama é o atendente. Segredo compartilhado (32+ caracteres); rotação = trocar a env nos dois lados | `401 UNAUTHORIZED` |
| Versão | Que os dois lados falam a mesma versão do contrato (`1`) | `400 VERSION_MISMATCH` |
| Ticket | **Qual organização e qual telefone**, e que esse telefone escreveu há menos de 30 minutos | `401 TICKET_MISSING` / `TICKET_INVALID` / `TICKET_EXPIRED` |

Ordem das checagens: token, versão, ticket, e por fim se a organização do ticket ainda tem a instância de WhatsApp e o
atendimento ativo (`403 ADDON_INACTIVE`).

**Organização e telefone saem só do ticket.** Nenhuma rota aceita `organizationId`, `customerId` nem telefone em
header, query ou body, e todos os bodies e queries são estritos: mandar um campo desconhecido é `422 VALIDATION_ERROR`.
Isso é proposital. Não tente "ajudar" passando o telefone de novo.

## 3. O ticket

- **De onde vem:** do encaminhamento de **cada** mensagem do cliente (campo `ticket` do corpo, seção 8).
  Mensagens enviadas pelo número do estabelecimento (`deMim: true`) vêm com `ticket: null`.
- **Validade:** 30 minutos (`expiraEm` no próprio objeto). Cada mensagem nova traz um ticket novo.
- **Qual usar:** sempre o da mensagem **mais recente** da conversa. Guarde-o junto do estado da conversa e troque a cada mensagem.
- **É opaco.** O formato é `<payload>.<assinatura>`, assinado só no Eliza. Não leia, não monte, não altere.
- **O que ele amarra:** a organização, o telefone do cliente e a instância de WhatsApp. Um ticket de uma conversa nunca
  serve para outra.
- **Expirou no meio do atendimento** (`TICKET_EXPIRED`)? Não insista com o mesmo. O cliente precisa mandar uma nova
  mensagem para você receber um ticket novo. Se estava no meio de uma ação, responda ao cliente quando ele voltar.
- Sem proatividade: não existe ticket sem o cliente ter escrito, então o atendente não inicia conversa.

## 4. Formato das respostas

```jsonc
{ "data": { ... }, "meta": { ... } }                                        // sucesso
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "details": { }, "request_id": "..." } }  // erro
```

- Toda resposta traz `X-Request-Id` (igual ao `request_id` do erro). Guarde-o no seu log: é o que o suporte do Eliza usa.
- O **status HTTP** é determinado pelo `code` (tabela da seção 10). Decida pelo `code`, não pela `message`.
- `message` é em português, escrita para você repassar ao cliente, e **nunca** contém dado de outro cliente.
- Os corpos usam camelCase em português (`servicoId`, `inicio`).
- Datas: entrada `AAAA-MM-DDTHH:mm` no relógio de **São Paulo**, sem offset. Saída: todo instante é um `Momento` `{ utc, local }`.
- Recurso de outro cliente é sempre `404 NOT_FOUND`, nunca "proibido": a API não confirma que ele existe.

## 5. Quem é o cliente (identificação)

`GET /contexto` devolve `identificacao.situacao`:

| Situação | Significa | O que pode |
|---|---|---|
| `identificado` | Exatamente um cadastro com o telefone do ticket. Vem `cliente.primeiroNome` | Tudo |
| `desconhecido` | Nenhum cadastro | Catálogo e horários, mensagens, escalonamento e **criar o cadastro** |
| `ambiguo` | Dois ou mais cadastros com o mesmo número | Só ler catálogo e escalar |

O Eliza **nunca desempata**. Em `ambiguo`, a equipe resolve: escale com `motivo: "cliente_ambiguo"`.

Sem identificação, `GET/POST /agendamentos`, `/agendamentos/{id}/*` e `GET/PATCH /cadastro` respondem `409
CUSTOMER_NOT_IDENTIFIED` (desconhecido) ou `409 CUSTOMER_AMBIGUOUS` (ambíguo). `POST /cadastro` faz o inverso: só vale
para `desconhecido`.

## 6. Fluxo típico de uma conversa

1. **Chegou mensagem** com ticket novo. Guarde o ticket.
2. **`GET /contexto`**, uma vez por turno, antes de responder. Traz a hora do servidor, o vocabulário do nicho
   (`organizacao.termos`: use "cliente", "profissional" etc. como o estabelecimento fala), o expediente, a política, quem é o cliente e os
   agendamentos futuros. `politica.instrucoesAtendimento` é texto do estabelecimento para você (avisos, tom).
3. **Entender o pedido** (isso é com o atendente). Para agendar:
   - `GET /servicos` e `GET /profissionais` (catálogo ativo; todo profissional atende todo serviço).
   - **`GET /horarios?servicoId=…&data=AAAA-MM-DD`** devolve os horários livres de **cada** profissional (com `motivoVazio` quando não há).
     Ofereça ao cliente só horários desta lista.
4. **`POST /agendamentos`** com `servicoId`, `profissionalId` e `inicio` (um dos horários oferecidos). Responde `201` com o agendamento em
   `pending`. Diga ao cliente que **aguarda a aprovação do estabelecimento**.
5. **`POST /mensagens`** com o texto para o cliente.
6. Mais tarde, no lembrete, o cliente responde "sim": o `contexto.aguardandoConfirmacao` lista os ids que esperam esse "sim".
   **`POST /agendamentos/{id}/confirmar`**.

Cada passo de escrita pode falhar por regra de negócio (seção 7); trate os `code` de erro, não só o caminho feliz.

### Exemplo mínimo (curl)

```bash
B=https://<host>/api/v1/autoatendimento
H=(-H "Authorization: Bearer $TOKEN" -H "X-Autoatendimento-Versao: 1" -H "X-Autoatendimento-Ticket: $TICKET")

curl -s "$B/contexto" "${H[@]}"
curl -s "$B/horarios?servicoId=$SERVICO&data=2026-10-05" "${H[@]}"
curl -s -X POST "$B/agendamentos" "${H[@]}" -H "Content-Type: application/json" \
  -d '{"servicoId":"'$SERVICO'","profissionalId":"'$PROF'","inicio":"2026-10-05T14:30","observacao":"Primeira vez"}'
curl -s -X POST "$B/mensagens" "${H[@]}" -H "Content-Type: application/json" \
  -d '{"texto":"Pronto! Seu horário está aguardando a aprovação do estabelecimento."}'
```

## 7. Regras que o atendente precisa conhecer

**Status do agendamento**

- Todo agendamento criado por aqui nasce **`pending`**: aguarda o estabelecimento aprovar. Só o tenant aprova.
  Não prometa o horário como garantido.
- **`pending` não se confirma.** `POST /confirmar` só vale em `scheduled` (o estabelecimento já aprovou) e antes do horário.
  Em `pending` devolve `409 INVALID_TRANSITION` com texto pronto. Confirmar um `confirmed` é idempotente (`200`).
- **Remarcar volta para `pending`**, mesmo se estava `confirmed`: o "confirmado" valia para o horário antigo e o estabelecimento
  aprova de novo. Avise o cliente.
- Cancelar muda para `canceled` e **nunca apaga** o registro.
- Use `podeCancelar`, `podeRemarcar` e `podeConfirmar` de cada agendamento: o Eliza já calculou com a política do estabelecimento. Não recalcule.

**Política do estabelecimento** (`contexto.politica`; valores padrão entre parênteses)

| Campo | Efeito | Erro quando viola |
|---|---|---|
| `antecedenciaMinimaMinutos` (120) | Criar, remarcar e **cancelar** exigem esta antecedência. `GET /horarios` já a aplica | `422 NOTICE_TOO_SHORT` |
| `janelaMaximaDias` (60) | Só de hoje até hoje + janela, em `/horarios`, criar e remarcar | `422 OUT_OF_WINDOW` |
| `maxAgendamentosAtivos` (3) | Agendamentos futuros ativos por cliente | `409 ACTIVE_LIMIT_REACHED` |

Dentro da antecedência mínima o cliente **não consegue** cancelar nem remarcar por aqui: escale para a equipe (`fora_da_politica`).

**Posse.** Só os agendamentos e o cadastro do telefone do ticket. Qualquer `id` que não seja dele responde `404`.

**Horários.** Se um horário está em `GET /horarios`, `POST /agendamentos` o aceita; se não está, recusa com `409
SLOT_UNAVAILABLE`, e `details.sugestoes` traz até 3 horários livres do mesmo dia e profissional. Outro cliente pode pegar o horário entre a consulta e a criação:
trate o 409 oferecendo as sugestões.

**Idempotência.** Repetir `POST /agendamentos` idêntico (mesmo cliente, profissional e início) em até 10 minutos devolve o agendamento
já criado, com o mesmo `id`. Retentativa por timeout é segura.

**Cadastro.**

- `POST /cadastro` (só `desconhecido`): `nome` e `documento` são obrigatórios; `email` e `dataNascimento` opcionais. O telefone é o do ticket.
  Documento já existente na organização: `409 CUSTOMER_CONFLICT` (o documento pode ser de outra pessoa; **escale**, não tente vincular).
- `PATCH /cadastro`: `nome`, `email` e `dataNascimento` sobrescrevem. `documento` só se o cadastro ainda não tem; se tem, `409 INVALID_TRANSITION`.
  O telefone nunca muda por aqui.
- `GET /cadastro` devolve o documento **mascarado** e só se há data de nascimento. Nunca endereço, observações nem documento completo.

## 8. Mensagens e escalonamento

**Responder ao cliente: `POST /mensagens`** `{ "texto": "..." }` (1 a 4000 caracteres). Vai para o telefone do ticket, pela instância
do estabelecimento, sem template nem reescrita. A resposta traz `mensagemId`. **Guarde-o:** o eco dessa mensagem volta pelo
encaminhamento com `deMim: true` e o mesmo id, e é assim que você diferencia o seu eco de uma resposta humana. Falha na Evolution:
`502 WHATSAPP_UNAVAILABLE` (tente de novo depois).

**Pedir ajuda humana: `POST /escalonamentos`** `{ "motivo": "...", "resumo": "..." }`.

| `motivo` | Quando |
|---|---|
| `pedido_do_cliente` | O cliente pediu uma pessoa |
| `cliente_ambiguo` | Identificação `ambiguo` |
| `fora_da_politica` | Pedido que a política não permite (ex.: cancelar em cima da hora) |
| `nao_entendi` | O atendente não entendeu |
| `reclamacao` | Reclamação |
| `outro` | Outro |

O Eliza manda um WhatsApp para o contato humano do estabelecimento. `equipeNotificada: false` **não é erro**: a organização não
configurou contato humano ou o envio falhou, então avise o cliente de outro jeito ("vou chamar alguém, aguarde"). O `resumo` não deve
conter dado sensível além do necessário. Nada é gravado em tabela nesta versão.

## 9. Encaminhamento Eliza → atendente

O atendente expõe **`POST {ATENDENTE_URL}/v1/mensagens`**. O Eliza chama a cada mensagem de texto do cliente e a cada mensagem
enviada pelo número do estabelecimento.

```jsonc
{
  "versao": 1,
  "mensagemId": "3EB0A1B2C3D4E5F60718",          // id no WhatsApp: chave de deduplicação
  "recebidaEm": "2026-10-02T13:00:00.000Z",
  "organizacao": { "id": "<uuid>", "nome": "Studio Exemplo" },
  "contato": { "telefone": "5511900000001", "nomeExibicao": "Maria" },
  "deMim": false,                                  // true = enviada PELO número do estabelecimento
  "conteudo": { "tipo": "texto", "texto": "Quero marcar um corte amanhã" },   // ou { "tipo": "nao_suportado", "tipoOriginal": "audioMessage" }
  "ticket": { "token": "<ticket>", "expiraEm": "2026-10-02T13:30:00.000Z" }   // null quando deMim = true
}
```

**Assinatura.** O Eliza assina o corpo exato que envia:

```
X-Eliza-Timestamp: <epoch em segundos>
X-Eliza-Assinatura: hex(HMAC-SHA256(ATENDENTE_ENCAMINHAMENTO_SECRET, timestamp + "." + corpoBruto))
```

Valide sobre o **corpo bruto** (antes de fazer `JSON.parse`), compare em tempo constante e rejeite se `|agora - timestamp| > 300` segundos.
Em Node:

```js
import { createHmac, timingSafeEqual } from "node:crypto"

function assinaturaValida(corpoBruto, timestamp, assinatura, segredo) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const esperada = createHmac("sha256", segredo).update(`${timestamp}.${corpoBruto}`).digest("hex")
  const a = Buffer.from(esperada), b = Buffer.from(assinatura ?? "")
  return a.length === b.length && timingSafeEqual(a, b)
}
```

**Resposta.** Devolva **`202 { "aceito": true }`** assim que validar e enfileirar; processe depois. O timeout do Eliza é de **3 s** e não há retentativa
(a Evolution já retenta o webhook): **deduplique por `mensagemId`**.

**Fallback.** Se o atendente estiver fora, der timeout, erro de rede ou responder diferente de `202`, o Eliza processa a mensagem pelo fluxo antigo
de palavra-chave (por exemplo, o "sim" ao lembrete continua confirmando). Isso só vale para `deMim: false`. Consequência: o atendente
pode ter perdido uma mensagem, então não presuma que viu a conversa inteira.

**`deMim: true`.** Pode ser o eco do próprio atendente (o `mensagemId` bate com um que `POST /mensagens` devolveu) ou alguém da equipe respondendo
pelo celular. Neste segundo caso o atendente deve **pausar** naquela conversa. Mensagens de grupo e de status nunca são encaminhadas;
mídia, áudio e localização chegam como `nao_suportado`.

## 10. Catálogo de erros

| `code` | HTTP | Quando | Como reagir |
|---|---|---|---|
| `INVALID_JSON` | 400 | Corpo não é JSON | Bug do atendente |
| `VERSION_MISMATCH` | 400 | `X-Autoatendimento-Versao` ≠ `1` | Atualize a cópia do contrato |
| `UNAUTHORIZED` | 401 | Token de serviço ausente ou errado | Configuração |
| `TICKET_MISSING` | 401 | Falta o header do ticket | Bug do atendente |
| `TICKET_INVALID` | 401 | Ticket adulterado ou mal formado | Use o ticket recebido, sem alterar |
| `TICKET_EXPIRED` | 401 | Passou de 30 min | Espere nova mensagem do cliente |
| `ADDON_INACTIVE` | 403 | Atendimento desligado para o estabelecimento, ou a instância de WhatsApp mudou | Pare de responder; o Eliza assume (fallback) |
| `NOT_FOUND` | 404 | Serviço, profissional ou agendamento inexistente, inativo ou de outro cliente | Refaça a consulta; não insista |
| `SLOT_UNAVAILABLE` | 409 | Horário indisponível. `details: { motivo, sugestoes }` | Ofereça as `sugestoes` |
| `INVALID_TRANSITION` | 409 | Status não permite (ex.: confirmar `pending`, cancelar `completed`, definir documento já existente) | Explique ao cliente com a `message` |
| `CUSTOMER_NOT_IDENTIFIED` | 409 | Telefone sem cadastro | Ofereça `POST /cadastro` |
| `CUSTOMER_AMBIGUOUS` | 409 | Mais de um cadastro com o telefone | Escale (`cliente_ambiguo`) |
| `CUSTOMER_CONFLICT` | 409 | Telefone já cadastrado (no POST) ou documento de outro cadastro | Escale |
| `ACTIVE_LIMIT_REACHED` | 409 | Máximo de agendamentos ativos | Sugira cancelar ou concluir um |
| `VALIDATION_ERROR` | 422 | Body/query inválido ou com campo desconhecido. `details: [{ field, message }]` | Corrija a chamada |
| `OUT_OF_WINDOW` | 422 | Data fora de [hoje, hoje + janela] | Peça outra data |
| `NOTICE_TOO_SHORT` | 422 | Dentro da antecedência mínima | Escale (`fora_da_politica`) |
| `RATE_LIMITED` | 429 | Limite da seção 11. `Retry-After` e `details.retry_after_seconds` | Espere |
| `WHATSAPP_UNAVAILABLE` | 502 | Evolution fora do ar ao enviar | Tente de novo depois |
| `INTERNAL_ERROR` | 500 | Erro inesperado ou segredo do canal não configurado | Registre o `request_id` |

## 11. Limites por telefone do ticket

Contêm um atendente em loop, não o cliente. Esgotado: `429 RATE_LIMITED` com `Retry-After`.

| Prefixo | Onde | Janela | Máx. |
|---|---|---|---|
| `aa-escrita` | criar, remarcar, cancelar, confirmar, `POST`/`PATCH /cadastro` | 1 h | 20 |
| `aa-criar` | criar agendamento | 24 h | 5 |
| `aa-msg-contato` | `POST /mensagens` | 1 h | 60 |
| `aa-msg-org` | `POST /mensagens` (conta a organização inteira) | 1 h | 600 |
| `aa-escalar` | `POST /escalonamentos` | 1 h | 3 |

Leituras (`GET`) não têm limite próprio de autoatendimento.

## 12. Testando pelo Swagger

A spec do Autoatendimento só é servida em **desenvolvimento** ou com `API_DOCS_INTERNAS=true` no Eliza (é uma API interna). Em produção,
sem a flag, `/api/v1/autoatendimento/openapi.json` responde `404` e o seletor da página não a mostra.

1. Suba o Eliza e abra `http://localhost:3000/api/v1/docs`; no seletor do topo escolha **Autoatendimento (interna)**.
2. Gere um ticket de desenvolvimento (de dentro de `web/`; lê `AUTOATENDIMENTO_TICKET_SECRET` do `.env.local`, não o imprime e recusa rodar com `NODE_ENV=production`):

   ```bash
   node scripts/ticket-dev.mjs <orgId> <telefone> <instancia>
   # ex.: node scripts/ticket-dev.mjs 0a6f2d94-8c15-4e7b-93da-4b1c8e5f7a02 5511900000001 minha-instancia
   ```

   `orgId` é `organizations.id`; `telefone` só dígitos com DDI; `instancia` é o `whatsapp_instance_name` da organização (a API confere que ainda é a dela;
   a organização também precisa ter `autoatendimento_config.ativo = true`). Vale 30 minutos.
3. **Authorize** e preencha: *TokenDeServico* = o `AUTOATENDIMENTO_API_TOKEN` do `.env.local` (só o valor, sem `Bearer`), *Ticket* = a saída do script,
   *Versao* = `1`. A autorização fica salva no navegador, mas o ticket vence em 30 minutos: gere outro.
4. **Try it out** nas rotas. Comece por `GET /contexto`.

Avisos:

- **Escrever é real.** `POST /agendamentos`, `remarcar`, `cancelar`, `confirmar` e `POST/PATCH /cadastro` mexem em dados reais da organização do ticket.
- **`POST /mensagens` e `POST /escalonamentos` enviam WhatsApp de verdade**: o primeiro ao telefone do ticket, o segundo ao contato humano do estabelecimento.
  Use um telefone seu e uma organização de teste.
- O ticket de desenvolvimento só prova o que o `.env.local` assina; ele não passa por um encaminhamento real.
- Os limites da seção 11 valem também aqui.
