# Relatório — Autoatendimento F0

Contrato: [contratos/autoatendimento/README.md](contratos/autoatendimento/README.md).

## Bloco A

Escopo: README §7 passos 2–4 (parcial): gateway de WhatsApp, `lib/autoatendimento/`
e as rotas de leitura e de cadastro. Escrita de agendamentos, mensagens,
escalonamentos e o ramo do webhook são do bloco B. Nenhuma migration neste bloco
(`autoatendimento_config` já estava aplicada, commit `9c87156`).

### Feito

**Passo 2 — `lib/whatsapp/gateway.ts`**: `enviarTexto({ organizationId, telefone, texto })` encapsula
`sendWhatsAppMessage` e devolve `{ ok: true, mensagemId }` (`key.id` da Evolution, ou `null`) ou
`{ ok: false, erro }`. Nada o usa ainda (bloco B).

**Passo 3 — `lib/autoatendimento/`**

| Arquivo | O que faz |
|---|---|
| `ticket.ts` | `emitirTicket` / `validarTicket`: `base64url(JSON).base64url(HMAC-SHA256)`, TTL 30 min, `timingSafeEqual`, `node:crypto`. Assinatura primeiro, `exp` depois (ticket forjado nunca revela "expirado"). `exp <= agora` já é expirado. |
| `autenticar.ts` | `autenticarTicket` (Autenticador de `lib/http/rota.ts`). Ordem: envs -> token de serviço (`UNAUTHORIZED`) -> versão (`VERSION_MISMATCH`) -> ticket (`TICKET_MISSING` / `TICKET_INVALID` / `TICKET_EXPIRED`) -> org tem a instância `inst` e config ativa (`ADDON_INACTIVE`). Devolve `{ org, telefone, config }`. |
| `config.ts` | `carregarConfig(db, orgId)`: `null` se sem linha, `ativo = false` ou org `is_demo`. |
| `identificar.ts` | `identificarCliente` (0/1/2+ -> `desconhecido`/`identificado`/`ambiguo`, nunca desempata, `primeiroNome`) e `exigirIdentificado` (`CUSTOMER_NOT_IDENTIFIED` / `CUSTOMER_AMBIGUOUS`). |
| `limites.ts` | `consumirLimite(db, prefixo, { org, telefone })` com os cinco prefixos `aa-*` do §6; `RATE_LIMITED` com `Retry-After` e `details.retry_after_seconds`. |
| `agendamentos.ts` | Leitura: `listarAgendamentosDoCliente` e `paraResumo` (`AgendamentoResumo` + flags `podeCancelar` / `podeRemarcar` / `podeConfirmar`). Sempre filtra por org e cliente. |
| `contexto.ts` | `montarContexto` (02). |
| `horarios.ts` | `consultarHorarios` (03), com o mapa de `motivoVazio` domínio -> contrato. |
| `cadastro.ts` | `lerCadastro`, `criarCadastro`, `atualizarCadastro`, `mascararDocumento` (05). |

**Passo 4 — rotas** (`criarRota` + `autenticarTicket`, uma por commit/grupo; todos os Zod `.strict()`;
org e telefone só do ticket):

- `GET /api/v1/autoatendimento/contexto`
- `GET .../servicos`, `GET .../profissionais`, `GET .../horarios`
- `GET .../agendamentos` (lista, máx. 20)
- `GET|POST|PATCH .../cadastro`

`web/middleware.ts` já exclui `api/v1` no matcher (`(?!api/v1|...)`), o que cobre `/api/v1/autoatendimento`.
O build lista as 6 rotas como dinâmicas.

**Envs**: as 4 do 01 estão em `docs/DEPLOY.md` (bloco de variáveis + seção própria). Não existe
`.env.example` no repo e o `.gitignore` ignora `.env*`, então o DEPLOY é o único registro. `web/.env.local` não foi tocado.

### Commits

| Hash | Conteúdo |
|---|---|
| `855c86e` | gateway, ticket, autenticar, config, identificar, limites, DEPLOY |
| `a388c0e` | `GET /contexto` (+ `gender` no dicionário de nichos) |
| `f53ffee` | `GET /servicos`, `/profissionais`, `/horarios` |
| `548cd2d` | `GET /agendamentos` |
| (último, ver `git log`) | cadastro (GET/POST/PATCH) + este relatório |

### Verificações

- `npx tsc --noEmit -p .` limpo antes e depois de cada commit.
- `npx eslint` limpo nos arquivos tocados.
- `npm run build` ok (as 6 rotas aparecem).
- Script descartável (fora do repo, `jiti` do próprio `web/node_modules`, segredos falsos gerados no script, banco falso, nenhuma chamada ao banco real), 100% OK:
  - ticket: válido, `expiraEm = +30 min`, assinatura adulterada, payload adulterado com assinatura antiga, expirado (+31 min e exatamente em `exp`), lixo, 3 partes, outro segredo, forjado+expirado vira `invalido`;
  - `autenticarTicket`: caminho feliz, token errado, sem `Authorization`, versão errada, sem versão, sem ticket, ticket lixo, ticket vencido, `inst` diferente, `ativo=false`, sem linha, org demo (todos `ADDON_INACTIVE`), sem `AUTOATENDIMENTO_API_TOKEN` e sem `AUTOATENDIMENTO_TICKET_SECRET` (falha fechada, `INTERNAL_ERROR`);
  - `identificarCliente`: 0 -> desconhecido, 1 (cadastro sem DDI, ticket com DDI) -> identificado + `primeiroNome`, 2 formas do mesmo celular -> ambiguo, ticket sem o 9 casa cadastro com o 9 e vice-versa, outro número -> desconhecido;
  - `mascararDocumento`: CPF cru e formatado, CNPJ, vazio e nulo.
- NÃO testado (depende de banco/servidor): rate limit, queries reais, travas do cadastro, o shape final das respostas. Ficam nos curls abaixo.

### Divergências contrato × código

1. **`motivoVazio`**: o Zod `MotivoSemHorario` do canal é em inglês (`organization_closed_day`, `professional_unavailable_day`, `outside_business_hours`, `fully_booked`, `antecedencia_minima`) e o domínio em português. Mapeei em `lib/autoatendimento/horarios.ts` (`agenda_cheia`, `intervalo`, `ocupado`, `fora_da_grade` -> `fully_booked`; os três últimos nem chegam a `motivoVazio`). Zod venceu na forma. **Achado fora do bloco:** `GET /api/v1/availability` (v1) devolve `empty_reason` com o valor do domínio cru (português), embora `contracts/api-v1/catalogo.ts` cite os nomes em inglês. Não mexi na v1; vale conferir.
2. **`Termos.genero`**: o contrato diz que lê `gender` do dicionário, mas `buildNiche` não o expunha no objeto final (só vivia na config). Adicionei `gender: config.gender ?? "m"` ao retorno de `buildNiche` (`lib/dictionaries/niches.ts`). Mudança aditiva; nenhum consumidor atual lê a chave.
3. **"Dicionário base"**: não existe `base` em `niches.ts`; usei `generico` como base (nicho sem dicionário, como `oficina`, ou `niche` nulo).
4. **`carregarConfig(orgId)`** no contrato; implementado como `carregarConfig(db, orgId)`, o estilo do repo (service role entra por parâmetro, como no domínio).
5. **`autenticarTicket` devolve `org` como o id (string)**, não o objeto da org.
6. **Ordem das checagens**: o README lista token, ticket, versão. Implementei token -> versão -> ticket: a versão é barata e um erro de contrato aparece mesmo sem ticket válido. Cada erro isolado responde o código esperado.
7. **POST /cadastro**: a ordem é body (422) -> `aa-escrita` -> identificação -> documento. Erro de body não consome o limite.
8. **Erro inesperado**: `criarRota` (núcleo compartilhado com a v1) loga `[api:v1] erro inesperado`, não `[autoatendimento:...]`. Logs próprios do canal usam o prefixo `[autoatendimento:<rota>]`; não mudei o núcleo.

### Decisões fora do contrato

- **Mudança no domínio** (mínima): `lib/domain/clientes.ts` passou a exportar `normalizarDocumento` e `buscarPorDocumento` (só o `export`). O cadastro precisa deles para a trava de documento e `resolverCliente` não serve (reusa o cadastro que casa por documento).
- **Falha fechada por tamanho**: `AUTOATENDIMENTO_API_TOKEN` e `AUTOATENDIMENTO_TICKET_SECRET` com menos de 32 caracteres contam como não configurados (o 01 pede >= 32 bytes). Resposta: 500 `INTERNAL_ERROR`, motivo só no log.
- **Org demo** responde `ADDON_INACTIVE` (o contrato diz que demo nunca é atendida, sem citar o código). Org suspensa não é checada (o contrato do canal não pede).
- **Sem auditoria** em tabela para o canal (a v1 tem `api_request_logs`; o contrato do canal não prevê). `criarRota` aceita `auditar` opcional.
- **Documento gravado normalizado** (só `[0-9A-Za-z]`), igual a `resolverCliente`; o telefone do POST recebe `55` quando tem 10/11 dígitos.
- **`PATCH` com `documento`** em cadastro que já tem um responde `INVALID_TRANSITION` mesmo se o valor for igual (como pede o 05), antes de qualquer escrita (sem atualização parcial).
- Contexto: `aguardandoConfirmacao` é calculado sobre os (até 10) agendamentos do próprio contexto.

### Como rodar os curls

Pré-requisito: o servidor com as duas envs (valores novos de `openssl rand -hex 32`, em `web/.env.local`,
que este bloco não tocou), mais uma org com linha em `autoatendimento_config` (`ativo = true`) e
`whatsapp_instance_name` preenchido:

```bash
AUTOATENDIMENTO_API_TOKEN=<64 hex>
AUTOATENDIMENTO_TICKET_SECRET=<64 hex>
```

Gerar um ticket de dev (30 min). Argumentos: id da org, telefone com DDI, `whatsapp_instance_name` da org.
O segredo vem da env (exporte antes, ou rode no `web/` com `set -a; . ./.env.local; set +a`):

```bash
ticket() {  # uso: ticket <orgId> <telefone> <instancia>
  node -e "const c=require('crypto');const [org,tel,inst]=process.argv.slice(1);const iat=Math.floor(Date.now()/1000);const p=Buffer.from(JSON.stringify({v:1,org,tel,inst,msg:'dev',iat,exp:iat+1800})).toString('base64url');console.log(p+'.'+c.createHmac('sha256',process.env.AUTOATENDIMENTO_TICKET_SECRET).update(p).digest('base64url'))" "$@"
}
B=http://localhost:3000/api/v1/autoatendimento
aa() {  # uso: aa <ticket> [args do curl...]
  local t=$1; shift
  curl -s "$@" -H "Authorization: Bearer $AUTOATENDIMENTO_API_TOKEN" -H "X-Autoatendimento-Versao: 1" -H "X-Autoatendimento-Ticket: $t"
}
T=$(ticket "$ORG" 5511987654321 "$INST")
aa $T $B/contexto | jq
```

Tickets de teste de erro:
vencido = mesmo one-liner com `iat` = agora − 2000 e `exp` = agora − 200; adulterado = troque um caractere da assinatura.

**Aceite 01** (a parte de código; as de RLS/migration já foram do orquestrador):

```bash
# add-on ativo=false na org  -> 403 ADDON_INACTIVE   (update autoatendimento_config set ativo=false ...)
aa $T -i $B/contexto
# sem linha, ou org is_demo=true -> 403 ADDON_INACTIVE
# ticket com inst diferente da org -> 403 ADDON_INACTIVE
aa $(ticket "$ORG" 5511987654321 instancia-errada) -i $B/contexto
# sem Authorization / token errado -> 401 UNAUTHORIZED
curl -s -i $B/contexto -H "X-Autoatendimento-Versao: 1" -H "X-Autoatendimento-Ticket: $T"
curl -s -i $B/contexto -H "Authorization: Bearer errado" -H "X-Autoatendimento-Versao: 1" -H "X-Autoatendimento-Ticket: $T"
# versão errada -> 400 VERSION_MISMATCH
curl -s -i $B/contexto -H "Authorization: Bearer $AUTOATENDIMENTO_API_TOKEN" -H "X-Autoatendimento-Versao: 2" -H "X-Autoatendimento-Ticket: $T"
# sem ticket -> 401 TICKET_MISSING; ticket adulterado -> 401 TICKET_INVALID; vencido -> 401 TICKET_EXPIRED
```

**Aceite 02** (`GET /contexto`; um ticket por telefone):

```bash
# telefone sem cadastro -> identificacao.situacao=desconhecido, agendamentos: []
aa $(ticket "$ORG" 5511900000001 "$INST") $B/contexto | jq '.data.identificacao,.data.agendamentos'
# cadastro gravado 11987654321, ticket 5511987654321 -> identificado
# ticket 551187654321 (sem o 9) contra cadastro 11987654321 -> identificado
# dois cadastros do mesmo celular (11987654321 e 5511987654321) -> ambiguo, agendamentos: []
# cadastro com deleted_at -> desconhecido
# agendamento canceled/passado nao aparece; aguardandoConfirmacao so com scheduled + reminder_sent_at
aa $T $B/contexto | jq '.data.agendamentos,.data.aguardandoConfirmacao'
# org de nicho sem dicionario (ex.: oficina) -> termos do generico, sem quebrar
aa $T $B/contexto | jq '.data.organizacao'
# a resposta nao tem documento/email/contato_humano_telefone/instancia
aa $T $B/contexto | grep -ciE 'document|contato_humano|whatsapp_instance'   # esperado 0
```

**Aceite 03**:

```bash
aa $T $B/servicos | jq
aa $T $B/profissionais | jq          # sem phone nem registro profissional
D=$(date -d tomorrow +%F)                       # use um dia util
aa $T "$B/horarios?servicoId=$SERV&data=$D" | jq
aa $T "$B/horarios?servicoId=$SERV&data=$D&profissionalId=$PROF" | jq
# servicoId de outra org -> 404
aa $T -i "$B/horarios?servicoId=$SERV_OUTRA_ORG&data=$D"
# ontem e alem da janela -> 422 OUT_OF_WINDOW
aa $T -i "$B/horarios?servicoId=$SERV&data=$(date -d yesterday +%F)"
aa $T -i "$B/horarios?servicoId=$SERV&data=$(date -d '+400 days' +%F)"
# query extra -> 422
aa $T -i "$B/horarios?servicoId=$SERV&data=$D&organizationId=$ORG"
# profissional sem expediente no dia aparece com horarios: [] e motivoVazio
# servico de 60 min, org com passo 30 e almoco 12-13: 11:30 nao aparece, 11:00 aparece
# hoje, com antecedencia de 120 min: primeiro horario >= agora + 120 min
```

(Também: `GET /agendamentos` do cliente identificado, só dele, máx. 20, com as flags.)

```bash
aa $T $B/agendamentos | jq
aa $(ticket "$ORG" 5511900000001 "$INST") -i $B/agendamentos   # desconhecido -> 409 CUSTOMER_NOT_IDENTIFIED
```

**Aceite 05**:

```bash
TN=$(ticket "$ORG" 5511900000002 "$INST")   # telefone sem cadastro
# desconhecido cria -> 201; depois GET /contexto vem identificado
aa $TN -i -X POST $B/cadastro -H "Content-Type: application/json" \
  -d '{"nome":"Maria Teste","documento":"39053344705","email":"maria@teste.com","dataNascimento":"1990-05-10"}'
aa $TN $B/contexto | jq '.data.identificacao'
# identificado tentando criar -> 409 CUSTOMER_CONFLICT
aa $TN -i -X POST $B/cadastro -H "Content-Type: application/json" -d '{"nome":"Maria Teste","documento":"39053344705"}'
# criar (outro telefone sem cadastro) com documento de outro cliente da org -> 409; o outro cadastro fica intacto
aa $(ticket "$ORG" 5511900000003 "$INST") -i -X POST $B/cadastro -H "Content-Type: application/json" -d '{"nome":"Joao Teste","documento":"39053344705"}'
# GET: documentoMascarado "***.***.447-05", dataNascimentoInformada true, sem address/notes/gender/documento
aa $TN $B/cadastro | jq
# PATCH de documento quando ja existe -> 409 INVALID_TRANSITION (o 05 fala em "409"), sem alterar
aa $TN -i -X PATCH $B/cadastro -H "Content-Type: application/json" -d '{"documento":"11144477735"}'
# PATCH de nome/email -> 200
aa $TN -X PATCH $B/cadastro -H "Content-Type: application/json" -d '{"nome":"Maria Teste Silva"}' | jq
# PATCH {} -> 422
aa $TN -i -X PATCH $B/cadastro -H "Content-Type: application/json" -d '{}'
# body com telefone / organizationId -> 422 (.strict())
aa $TN -i -X PATCH $B/cadastro -H "Content-Type: application/json" -d '{"telefone":"5511999999999"}'
# PATCH de documento num cadastro SEM documento, com o documento de outro cliente -> 409 CUSTOMER_CONFLICT
# ticket ambiguo: GET/PATCH -> 409 CUSTOMER_AMBIGUOUS
# 21 escritas na mesma hora -> 429 RATE_LIMITED com header Retry-After e details.retry_after_seconds
```

Observação para o orquestrador: o 05 diz "`PATCH` de documento quando já existe um → 409". O código responde
`INVALID_TRANSITION`, que em `HTTP_STATUS_BY_CODE` é 409, então o status confere.

## Bloco B

Escopo: README §7 passo 4 (da escrita de agendamentos em diante) e passo 5 (ramo do webhook). Nenhuma
migration. `web/.env.local` não foi tocado e nenhuma linha de `autoatendimento_config` foi criada.

### Feito

| Grupo | Rotas / peças |
|---|---|
| 1. Escrita de agendamentos (04) | `POST /agendamentos`, `POST /agendamentos/{id}/remarcar`, `/cancelar`, `/confirmar` |
| 2. Mensagens (06) | `POST /mensagens` |
| 3. Escalonamentos (06) | `POST /escalonamentos` |
| 4. Encaminhamento (06) | `lib/autoatendimento/encaminhar.ts` + um ramo no webhook |

Ordem em toda escrita: body (422) -> limites -> identificação -> posse/regras. Erro de body não consome limite
(mesma ordem do cadastro, bloco A). Erros do canal em português, sem dado de outro cliente.

### Arquivos

Novos: `lib/autoatendimento/escrita.ts` (criar/remarcar/cancelar/confirmar do cliente, regras do canal),
`corpo.ts` (corpo opcional), `mensagens.ts`, `escalonamento.ts`, `encaminhar.ts`;
`lib/whatsapp/extrair-mensagem.ts`; rotas `agendamentos/[id]/{remarcar,cancelar,confirmar}`, `mensagens`, `escalonamentos`.

Alterados: `agendamentos/route.ts` (POST), `lib/autoatendimento/agendamentos.ts` (`carregarDoCliente` = posse,
`resumoDeCompleto`, `contarAtivosFuturos`, `buscarRetentativa`), `lib/autoatendimento/horarios.ts` (só `export` de
`somarDias`), `lib/domain/agendamentos.ts` (ver decisões), `app/api/webhooks/whatsapp/[[...slug]]/route.ts`.

### Commits

| Hash | Conteúdo |
|---|---|
| `35f7f37` | escrita de agendamentos |
| `36b3483` | `POST /mensagens` |
| `0c8dbfd` | `POST /escalonamentos` |
| `905841c` | encaminhamento no webhook |
| (último, ver `git log`) | este relatório |

### Verificações

- `npx tsc --noEmit -p .` limpo antes e depois de cada commit; `npm run build` ok (as 11 rotas do canal aparecem como dinâmicas, o webhook também).
- `npx eslint` limpo nos arquivos tocados. O `route.ts` do webhook mantém os 2 `no-explicit-any` que já tinha (`body: any`, `catch (error: any)`); os extratores movidos ganharam um `eslint-disable` de arquivo com justificativa (payload externo sem schema).
- Script descartável fora do repo (`jiti` do `web/node_modules`, banco falso em memória, domínio/gateway/fetch falsos, segredos gerados no script; nada tocou o banco real nem enviou WhatsApp), 100% OK:
  - criar: Ator (`autoatendimento`, `origem`, `podeNotificar null`), `status pending`, cliente do ticket, antecedência da config; C5 (retentativa devolve o MESMO id sem chamar o domínio; corrida: o domínio acusa `SLOT_UNAVAILABLE` e a rota devolve o do mesmo cliente; mesmo horário de OUTRO cliente, criado há 20 min, outro profissional, cancelado -> `SLOT_UNAVAILABLE`); `ACTIVE_LIMIT_REACHED` (cancelado e de outro cliente não contam); `OUT_OF_WINDOW` (+40 dias, ontem); `NOTICE_TOO_SHORT`; serviço/profissional de outra org -> `NOT_FOUND`;
  - posse: cancelar/remarcar/confirmar agendamento de outro cliente, id inexistente e id não-UUID -> `NOT_FOUND`, sem nenhuma escrita tentada;
  - cancelar (fora/dentro da antecedência, já cancelado), remarcar (antecedência, status final, janela, profissional opcional, sem `servicoId`), confirmar (`pending` -> `INVALID_TRANSITION`, `confirmed` -> idempotente sem escrita, `scheduled` -> `mudarStatus`, já iniciado -> `INVALID_TRANSITION`);
  - limites `aa-escrita` (21ª) e `aa-criar` (6ª) -> `RATE_LIMITED` com `Retry-After`; contador por telefone;
  - mensagens: entrega no telefone do ticket, `mensagemId` (ou `null`), falha da Evolution -> `WHATSAPP_UNAVAILABLE` 502 sem vazar o motivo; escalonamento: sem contato -> `false`, com contato -> texto e destino certos, falha -> `false`;
  - encaminhamento: 202 -> `true`; assinatura recalculada sobre o corpo recebido bate, corpo alterado em 1 byte não bate; corpo valida no Zod; ticket validado por `validarTicket` (org, tel, inst, msg, TTL 30 min); `fromMe` -> `deMim true`, `ticket null`; `remoteJidAlt`; `nao_suportado`; 500, 200, erro de rede e timeout real de 3 s -> `false` com `[autoatendimento:encaminhar] fallback <motivo>`; `deMim` com falha -> `false` sem a palavra "fallback"; sem config / inativa / demo / grupo / `status@broadcast` / mensagem > 10 min / instância sem org / `ATENDENTE_URL` vazia (sem tocar no banco) / segredo ausente -> nunca envia; erro inesperado nunca lança;
  - webhook (rota real, sem `ATENDENTE_URL`): `fromMe` -> `ignored_from_me`, mensagem velha -> `ignored_old_message`, sem texto -> `no_text_content`, evento que não é mensagem -> `ignored_not_message`.
- NÃO testado (depende de banco/servidor/Evolution): rate limit no Postgres, queries reais (inclusive a exclusion constraint), `validarHorario` real com `exigirGrade`, shape final das respostas HTTP, o webhook inteiro com org e config reais. Ficam nos curls abaixo.
- Painel: nenhuma página do painel está estática (o build lista todas como dinâmicas), então as rotas novas não precisam de `revalidate`.

### Divergências contrato × código

1. **Aceite 06 "ticket da org A usado depois de a org A trocar de instância -> 401"** x **README §2 "`ADDON_INACTIVE`"** (403). O bloco A implementou o §2 (`autenticarTicket` já confere `inst`), então o `POST /mensagens` herda: `403 ADDON_INACTIVE`, não 401. O passo 2 do 06 ("senão `TICKET_INVALID`") fica coberto por essa checagem e não repeti no handler. Recomendação: corrigir o texto do aceite (ou do §2), não o código.
2. **06 / gateway:** o contrato diz `gateway.enviarTexto({ orgId, ... })`; o gateway do bloco A usa `organizationId`. Usei o que existe.
3. **Escalonamento, "Motivo: <motivo>"**: o motivo do Zod é um enum (`reclamacao`...). Mandei o rótulo em português na mensagem para a equipe, não o valor cru.
4. **`podeRemarcar` falso (04 remarcar passo 1)**: "NOTICE_TOO_SHORT se o motivo for tempo; INVALID_TRANSITION se for status". Implementado checando o status primeiro (`INVALID_TRANSITION`), depois a antecedência (`NOTICE_TOO_SHORT`). O mesmo vale para cancelar.
5. **Id da rota que não é UUID** responde `NOT_FOUND` (igual ao registro inexistente), não `VALIDATION_ERROR`: o Zod `AgendamentoIdParams` existe, mas a posse diz que a API não confirma nada.
6. **Cancelar e confirmar com corpo vazio**: o `body()` do `criarRota` rejeita corpo vazio (`INVALID_JSON`). Cancelar tem corpo opcional e confirmar tem corpo vazio por contrato, então criei `corpoOpcional` (vazio vale `{}`; o resto valida igual).

### Decisões fora do contrato

- **Mudança mínima no domínio:** `EntradaEdicao` ganhou `antecedenciaMinutos?` e `editarAgendamento` passa para `corteDeHorario`, igual a `criarAgendamento`. Sem isso, a remarcação validava com `naoAntesDe = agora` e as `sugestoes` de `SLOT_UNAVAILABLE` podiam oferecer horário que a rota depois recusa por antecedência (C4 quebrada). Opcional e sem efeito nos outros canais.
- **C5 em dois pontos:** o contrato manda procurar o agendamento só quando vem `SLOT_UNAVAILABLE`. Mas o "criar duas vezes seguidas" do aceite não chega à constraint (o `validarHorario` já recusa o horário que o primeiro pedido ocupou) e, com `max_agendamentos_ativos` baixo, a retentativa cairia em `ACTIVE_LIMIT_REACHED`. Por isso a busca roda ANTES do limite de ativos (caso comum) e de novo ao receber `SLOT_UNAVAILABLE` (corrida real). Custa 1 query por criação. A busca só considera status ativo (`pending`/`scheduled`/`confirmed`): devolver um cancelado como "sucesso" seria errado. A retentativa responde 201 (mesmo corpo).
- **Limite de ativos** = futuros com status `pending`/`scheduled`/`confirmed`, o mesmo filtro da listagem e do contexto.
- **Ordem de checagem na criação:** serviço/profissional (`NOT_FOUND`) -> C5 -> limite de ativos -> janela/antecedência -> domínio, como o 04, com o C5 encaixado.
- **Remarcar para o mesmo horário e o mesmo profissional** não é recusado (o contrato não manda): o domínio não vê "mudança de horário", mas, no canal, volta o status a `pending` mesmo assim. Achado: um `confirmed` remarcado "para o mesmo horário" vira `pending` sem reagendar nada. Vale decidir no domínio se isso deve ser recusado.
- **`tipoOriginal`** de `nao_suportado` ignora a chave `messageContextInfo` (envelope, não conteúdo); sem chave, `"desconhecido"`.
- **Encaminhamento:** mensagem com mais de 10 min não é encaminhada (mesma guarda do webhook; o ticket afirma "escreveu há menos de 30 min", e ticket novo em mensagem velha furaria isso). Sem `ATENDENTE_ENCAMINHAMENTO_SECRET` (qualquer tamanho acima de zero) ou com segredo do ticket inválido: fallback com log. O ramo roda ANTES do descarte de `fromMe` (precisa dele, para a org com add-on) e é a única coisa que consulta a org/config antes do classificador; com `ATENDENTE_URL` vazia não toca no banco e o webhook fica byte a byte como era. Com `ATENDENTE_URL` setada, toda mensagem passa a custar 2 queries (org + config) antes do fluxo antigo.
- **`deMim` com falha:** não há fluxo antigo a cumprir (`fromMe` já era descartado), então só loga `deMim descartado <motivo>`, sem a palavra `fallback`.
- **Refatoração do webhook** limitada a mover `extractMessageText`, `extractIncomingNumber` e `extractInstanceName` (sem alterar uma linha delas) para `lib/whatsapp/extrair-mensagem.ts`, para o encaminhamento usar "a mesma extração" sem copiar. Resposta do webhook quando o atendente aceita: `200 { "status": "forwarded_to_attendant" }`.
- Não gravei `appointment_logs` por conta própria: o log `created`/`rescheduled`/`canceled`/`confirmed` com `source = 'autoatendimento'` vem do domínio (`registrarLog`), com `raw_message` = motivo no cancelamento.

### Curls

Pré-requisitos e helpers `ticket` / `aa` / `$B`: ver "Como rodar os curls" do bloco A. Além disso, `$SERV` e `$PROF` (ids ativos da org), `$D` um dia útil dentro da janela e um horário livre `$H` (de `GET /horarios`), no formato `AAAA-MM-DDTHH:mm`. Use um telefone com cadastro (`$T`) e outro, de outro cliente da mesma org (`$T2`), para a posse. `max_agendamentos_ativos`, `janela_maxima_dias` e `antecedencia_minima_minutos` vêm da linha de config da org.

**Aceite 04 (escrita)**

```bash
J='Content-Type: application/json'
# criar no horário livre -> 201, status pending; no banco: appointment_logs.action='created', source='autoatendimento'; nenhum WhatsApp enviado
aa $T -i -X POST $B/agendamentos -H "$J" -d "{\"servicoId\":\"$SERV\",\"profissionalId\":\"$PROF\",\"inicio\":\"${D}T$H\",\"observacao\":\"primeira vez\"}"
# a mesma chamada de novo -> 201 com o MESMO id (C5)
# horário que não aparece em /horarios -> 409 SLOT_UNAVAILABLE com details.sugestoes
aa $T -i -X POST $B/agendamentos -H "$J" -d "{\"servicoId\":\"$SERV\",\"profissionalId\":\"$PROF\",\"inicio\":\"${D}T03:10\"}"
# cliente já no máximo de ativos -> 409 ACTIVE_LIMIT_REACHED (crie até chegar em max_agendamentos_ativos e tente outro horário)
# fora da janela -> 422 OUT_OF_WINDOW ; dentro da antecedência (ex.: daqui a 10 min) -> 422 NOTICE_TOO_SHORT
aa $T -i -X POST $B/agendamentos -H "$J" -d "{\"servicoId\":\"$SERV\",\"profissionalId\":\"$PROF\",\"inicio\":\"$(date -d '+400 days' +%F)T10:00\"}"
# body com campo extra -> 422 VALIDATION_ERROR
aa $T -i -X POST $B/agendamentos -H "$J" -d "{\"servicoId\":\"$SERV\",\"profissionalId\":\"$PROF\",\"inicio\":\"${D}T$H\",\"customerId\":\"x\"}"
aa $T -i -X POST $B/agendamentos -H "$J" -d "{\"servicoId\":\"$SERV\",\"profissionalId\":\"$PROF\",\"inicio\":\"${D}T$H\",\"organizationId\":\"$ORG\"}"
# cliente desconhecido -> 409 CUSTOMER_NOT_IDENTIFIED ; ambíguo -> 409 CUSTOMER_AMBIGUOUS
# 21 escritas na hora -> 429 RATE_LIMITED ; 6 criações em 24 h -> 429

ID=<id do agendamento criado>
# remarcar para 30 min depois do próprio horário (sobreposto) -> 200, status volta a pending, mesmo id
aa $T -i -X POST $B/agendamentos/$ID/remarcar -H "$J" -d "{\"inicio\":\"${D}T<hora+30min>\"}"
#   no banco: reminder_sent_at e reminder_morning_sent_at = null; log action='rescheduled', raw_message='<antigo> -> <novo>'
# remarcar com outro profissional; com profissional de outra org -> 404
aa $T -i -X POST $B/agendamentos/$ID/remarcar -H "$J" -d "{\"inicio\":\"${D}T$H\",\"profissionalId\":\"$PROF2\"}"
# posse: cancelar/remarcar/confirmar o agendamento de OUTRO cliente da mesma org -> 404 NOT_FOUND
aa $T2 -i -X POST $B/agendamentos/$ID/cancelar
aa $T2 -i -X POST $B/agendamentos/$ID/remarcar -H "$J" -d "{\"inicio\":\"${D}T$H\"}"
aa $T2 -i -X POST $B/agendamentos/$ID/confirmar
# cancelar dentro da antecedência -> 422 NOTICE_TOO_SHORT (agendamento daqui a menos que antecedencia_minima)
# cancelar fora da antecedência -> 200 status canceled; o registro continua existindo; log action='canceled', raw_message=motivo
aa $T -i -X POST $B/agendamentos/$ID/cancelar -H "$J" -d '{"motivo":"imprevisto"}'
aa $T -i -X POST $B/agendamentos/$ID/cancelar      # de novo -> 409 INVALID_TRANSITION
# confirmar pending -> 409 INVALID_TRANSITION (o tenant aprova no painel: pending -> scheduled)
aa $T -i -X POST $B/agendamentos/$ID2/confirmar
# confirmar scheduled -> 200 confirmed; de novo -> 200 sem 2º log (appointment_logs: 1 linha 'confirmed')
aa $T -i -X POST $B/agendamentos/$ID2/confirmar
aa $T -i -X POST $B/agendamentos/$ID2/confirmar
# painel e página pública: criar um agendamento pelos dois e conferir status, mensagem e log como antes
```

**Aceite 06 (mensagens, escalonamento, encaminhamento)**

```bash
# POST /mensagens: o texto chega no telefone do ticket (use o SEU número no ticket); a resposta traz mensagemId
aa $T -i -X POST $B/mensagens -H "$J" -d '{"texto":"teste do atendente"}'
# campo de destino no body -> 422
aa $T -i -X POST $B/mensagens -H "$J" -d '{"texto":"oi","telefone":"5511999999999"}'
# ticket da org cuja instância foi trocada (update organizations set whatsapp_instance_name=...) -> 403 ADDON_INACTIVE (divergência 1)
# 61 mensagens na hora -> 429 (aa-msg-contato)
# escalonamento sem contato_humano_telefone na config -> 200 { equipeNotificada: false }
aa $T -i -X POST $B/escalonamentos -H "$J" -d '{"motivo":"pedido_do_cliente","resumo":"Quer falar com uma pessoa"}'
# com contato_humano_telefone preenchido (SEU número) -> 200 true e a mensagem chega, pelo WhatsApp da org
# 4º escalonamento na hora -> 429 ; ticket de cliente ambíguo/desconhecido também escala (não exige identificação)
# a resposta nunca traz o contato_humano_telefone
aa $T -X POST $B/escalonamentos -H "$J" -d '{"motivo":"outro","resumo":"x"}' | grep -c contato_humano   # esperado 0
```

Encaminhamento sem enviar mensagem real: o webhook aceita POST com o segredo no caminho e o payload da Evolution.
**Não use o telefone de um cliente real com texto "sim"/"cancelar" no caminho de fallback** (ele confirma/cancela e responde pelo WhatsApp de verdade); use um número sem cadastro (cai em `customer_not_found`, nada é enviado).

```bash
# 1. servidor de eco local (o "atendente"): confere a assinatura e responde o status de $RESP (padrão 202)
cd web && set -a; . ./.env.local; set +a
RESP=202 node -e "const h=require('http'),c=require('crypto');h.createServer((q,r)=>{let b='';q.on('data',d=>b+=d);q.on('end',()=>{const s=c.createHmac('sha256',process.env.ATENDENTE_ENCAMINHAMENTO_SECRET).update(q.headers['x-eliza-timestamp']+'.'+b).digest('hex');console.log(q.url,'assinatura valida:',s===q.headers['x-eliza-assinatura']);console.log(b);r.statusCode=+(process.env.RESP||202);r.end('{\"aceito\":true}')})}).listen(4100)" &
# 2. no web/.env.local (você faz): ATENDENTE_URL=http://localhost:4100 e ATENDENTE_ENCAMINHAMENTO_SECRET=<64 hex>; reiniciar o dev server
# 3. helper de payload (instância = whatsapp_instance_name da org que tem config ativa)
W=http://localhost:3000/api/webhooks/whatsapp/$WHATSAPP_WEBHOOK_SECRET
msg() {  # uso: msg <instancia> <jid> <fromMe true|false> <texto>
  curl -s -X POST $W -H 'Content-Type: application/json' -d "{\"event\":\"messages.upsert\",\"instance\":\"$1\",\"data\":{\"key\":{\"id\":\"TESTE$RANDOM\",\"remoteJid\":\"$2\",\"fromMe\":$3},\"pushName\":\"Teste\",\"message\":{\"conversation\":\"$4\"},\"messageTimestamp\":$(date +%s)}}"
}
# org ativa, mensagem do cliente -> {"status":"forwarded_to_attendant"}; o eco imprime 'assinatura valida: true' e o corpo com ticket
msg "$INST" 5511900000009@s.whatsapp.net false "oi, quero marcar"
# o token do ticket do corpo é aceito pela API: aa <token> $B/contexto | jq
# org ativa, fromMe -> forwarded, corpo com deMim:true e ticket:null
msg "$INST" 5511900000009@s.whatsapp.net true "ja te respondo"
# grupo e status -> nunca encaminha (o eco não imprime nada; segue o fluxo antigo)
msg "$INST" 120363000000@g.us false "oi"
msg "$INST" status@broadcast false "oi"
# atendente fora do ar: reinicie o eco com RESP=500 (ou pare-o) e mande de um número SEM cadastro:
#   {"status":"processed_confirmation","result":{"ok":false,"reason":"customer_not_found"}} e, no log do servidor, [autoatendimento:encaminhar] fallback ...
msg "$INST" 5511900000009@s.whatsapp.net false "sim"
# fromMe com o atendente fora do ar -> {"status":"ignored_from_me"} e log 'deMim descartado'
# org sem linha de config / ativo=false / org demo com config ativa -> nunca encaminha (eco mudo); fromMe -> ignored_from_me
# "sim" ao lembrete com o atendente fora do ar ainda confirma pelo fluxo antigo: só com um cliente de TESTE seu, com agendamento scheduled futuro e o número no seu WhatsApp
```

## Verificação do orquestrador (2026-10-06)

Servidor de dev com `AUTOATENDIMENTO_API_TOKEN`/`AUTOATENDIMENTO_TICKET_SECRET` novos,
`ATENDENTE_URL` vazia, org `admin` com `autoatendimento_config.ativo = true` (inserida via MCP).

| Aceite | Caso | Resultado |
|---|---|---|
| 01 | sem token / token errado / versão 2 / sem ticket / adulterado / vencido / outra instância | 401 / 401 / 400 `VERSION_MISMATCH` / 401 `TICKET_MISSING` / 401 `TICKET_INVALID` / 401 `TICKET_EXPIRED` / 403 `ADDON_INACTIVE` ✓ |
| 02 | telefone sem cadastro / com cadastro; contexto sem documento, contato humano ou instância | `desconhecido` / `identificado` + `primeiroNome`; grep = 0 ✓ |
| 03 | profissionais sem telefone; horários de serviço 45 min; data passada; query extra; serviço de outra org | 11:30/12:30/17:30 fora ✓; 422 `OUT_OF_WINDOW`; 422; 404 ✓ |
| 04 | criar (nasce `pending`, log `autoatendimento`); repetir (C5, mesmo id); fora da grade 15:10; antecedência < 2 h; `customerId` no body | ✓; ✓; 409 `fora_da_grade` + sugestões; 422 `NOTICE_TOO_SHORT`; 422 ✓ |
| 04 | confirmar `pending`; remarcar mesmo horário (no-op, sem log); remarcar sobreposto 13:00→13:30 | 409 com mensagem de aguardando aprovação; segue `pending`; ✓ |
| 04 | ciclo: tenant aprova pela v1 → bot confirma (2× idempotente) → bot remarca (volta `pending`) → bot cancela | ✓ (logs: created, rescheduled, scheduled/api, confirmed, rescheduled, canceled) |
| 04 | outro cliente identificado cancela/remarca agendamento alheio | 404 `NOT_FOUND` ✓ |
| 05 | GET identificado; GET desconhecido; POST com cadastro existente; PATCH vazio; PATCH com telefone; POST novo (documento mascarado `***X123`) | ✓ / 409 / 409 `CUSTOMER_CONFLICT` / 422 / 422 / 201 ✓ |

**Não testado com servidor real** (coberto só pelos scripts de banco falso do bloco B):
`POST /mensagens` e `/escalonamentos` (mandariam WhatsApp real pela instância da org) e o
encaminhamento do webhook (precisa de `ATENDENTE_URL` + servidor de eco; o fallback para o fluxo
de palavra-chave responde ao cliente de verdade).

Dados de teste na org `admin`: clientes "TESTE API Claude" e "TESTE F0 Outro"; agendamento
`TESTE-F0` cancelado; `autoatendimento_config` ativa (sem efeito enquanto `ATENDENTE_URL` estiver vazia).
