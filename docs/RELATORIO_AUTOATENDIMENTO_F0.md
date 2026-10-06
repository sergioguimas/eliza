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
