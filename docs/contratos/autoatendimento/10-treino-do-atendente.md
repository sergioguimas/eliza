# 10 — Treino do atendente pelo painel

> TO-BE · **Não toca a API de Autoatendimento** (o header de versão continua `1`, ver C35) · ver [README](README.md)
> **Escrito em:** 2026-10-27 · **Origem:** `Projetos/sola-agens/docs/RODADA-5-TREINAMENTO.md` (T1–T12) e o
> contrato do agens `sola-agens/specs/06-treinamento.md` (a API que este contrato consome)
> **Zod novos:** `contracts/autoatendimento/treino.ts` · **Migration:** nenhuma

## Para quem executa

Mesmas regras do [README](README.md#para-quem-executa): os `.md` dizem **o que** e **por quê**; os Zod
são a forma exata. Onde este arquivo der um valor fechado, use o valor. Se o código contradisser uma
premissa daqui, o código vence: pare, registre e siga o que é correto.

**O que se constrói:** uma página no painel onde o dono ou um admin da org **treina o atendente**. O
agens faz de conta que é um cliente, a pessoa responde como responderia de verdade, e ao encerrar o
agens aprende o jeito dela escrever (tratamento, emojis, pontuação, tom, exemplos). A página mostra o
que foi aprendido, deixa voltar versões, tirar um padrão e decidir as "notas" (fatos do negócio que
apareceram no treino). **Nada de LLM, prompt ou lógica de aprendizado no Eliza** (C1 continua valendo):
o Eliza autentica, assina, repassa e mostra.

**Pré-requisitos:**
- **Contrato 08** executado para a prévia e para o ensaio usar o catálogo real (ticket de visitante,
  C33). Sem ele, o treino funciona com ensaios genéricos e a aba Prévia fica escondida.
- Ligar em produção exige a **F2c** do sola-agens (`specs/06`). O lado do Eliza pode ser construído e
  testado com um agens falso.
- Os envios automáticos que pausavam o atendente **não** são deste contrato: estão no
  [09](09-avisos-do-sistema.md) (A11).

```txt
navegador (painel, owner/admin)      Eliza (server actions)                          sola-agens
 /configuracoes/atendente ──action──▶ usuário → org → papel → add-on ativo
                                      assinatura do operador (ATENDENTE_TREINO_SECRET)
                                      ticket de visitante (08), se disponível
                                      ──POST/GET {ATENDENTE_URL}/v1/treino/...──────▶ specs/06 §5
 ◀── dados para a tela ───────────────◀── JSON validado (Zod) ◀───────────────────┘
 "aplicar nota" ──action──▶ instrucoes_atendimento += nota (service role) → marca no agens
```

## Resumo

| # | Mudança | Por quê |
|---|---|---|
| 1 | Env `ATENDENTE_TREINO_SECRET` | Segredo próprio do treino, separado do encaminhamento (S9, C31) |
| 2 | `lib/autoatendimento/treino.ts`: cliente assinado do agens | Um lugar para assinatura, timeout e tradução de erro |
| 3 | `contracts/autoatendimento/treino.ts`: Zod das chamadas | Forma exata do que vai e volta |
| 4 | `app/actions/atendente-treino.ts`: server actions | Autorização no servidor; o navegador nunca fala com o agens (C29) |
| 5 | Página `/configuracoes/atendente` com 5 abas | Treinar, O que aprendi, Versões, Notas, Prévia (C28) |
| 6 | Aplicar nota → `instrucoes_atendimento` | Fato do negócio fica na config do Eliza, não no perfil (S12, C34) |

## 1. Quando aparece

A página e o link para ela aparecem se, e só se:

1. o usuário logado tem `profiles.role` em `owner` ou `admin` (mesmo gate da aba WhatsApp em
   `/configuracoes`);
2. a org tem linha em `autoatendimento_config` com `ativo = true` (`carregarConfig`);
3. o servidor tem `ATENDENTE_URL` e `ATENDENTE_TREINO_SECRET` (≥ 32 caracteres).

Sem coluna nova (C30): quem tem o atendente ligado pode treiná-lo. Faltou 1 → a página responde
`notFound()` e o link não aparece. Faltou 3 com 1 e 2 cumpridos → o link aparece e a página mostra
"O treino ainda não está disponível neste servidor" (sem dizer qual env falta), com log
`[atendente:treino] env ausente`.

**Toda server action repete as três verificações** (não confia em a página ter checado). Papel ou
add-on errados → `{ ok: false, erro: "NAO_PERMITIDO" }`, sem chamar o agens.

## 2. Env

```env
# Segredo do treino (Eliza → agens). Mesmo valor de ELIZA_TREINO_SECRET no agens. openssl rand -hex 32
ATENDENTE_TREINO_SECRET=
```

Em `web/.env.example` (seção do autoatendimento) e `docs/DEPLOY.md` (tabela de envs). Não reaproveitar
`ATENDENTE_ENCAMINHAMENTO_SECRET`: vazar a chave das mensagens não pode permitir mudar como o bot fala
com todos os clientes (C31).

## 3. Cliente do agens (`lib/autoatendimento/treino.ts`)

`import "server-only"`. Uma função de baixo nível e uma por rota da `specs/06 §5`:

```ts
type Operador = { tenant: string; id: string; papel: "owner" | "admin"; nome: string | null }

async function chamarTreino<T>(p: {
  metodo: "GET" | "POST" | "DELETE"
  caminho: string            // depois de {ATENDENTE_URL}/v1/treino, ex.: "/sessoes/abc/mensagens"
  operador: Operador
  corpo?: Record<string, unknown>   // sem `operador`: a função acrescenta
  schema: z.ZodType<T>
  timeoutMs: number
}): Promise<{ ok: true; dados: T } | { ok: false; erro: ErroTreino }>
```

**Assinatura** (igual à `specs/06 §4`), reaproveitando `assinarEncaminhamento` de `encaminhar.ts` com
o segredo do treino:

- `POST`/`DELETE` com corpo: `corpo = JSON.stringify({ operador, ...p.corpo })`;
  `X-Eliza-Assinatura = assinarEncaminhamento(segredo, ts, corpo)`.
- `GET` (e `DELETE` sem corpo): headers `X-Agens-Tenant`, `X-Agens-Operador-Id`,
  `X-Agens-Operador-Papel`; assina a string `` `${tenant}.${id}.${papel}` `` no lugar do corpo.
- `X-Eliza-Timestamp` = epoch em segundos, gerado na hora da chamada.

**`operador`** sai **sempre do servidor**: `tenant = profiles.organization_id`, `id = auth user id`,
`papel = profiles.role`, `nome = profiles.full_name` (primeiro nome, até 40 caracteres). Nenhum desses
campos vem do navegador.

**Timeouts** (`AbortController`): `POST /sessoes`, `/mensagens`, `/encerrar` e `/previa` = **45 s**
(chamam o LLM); as demais = **10 s**.

**Erros** → `ErroTreino`, que a tela traduz em texto (§5.6):

| Do agens | `ErroTreino` |
|---|---|
| `404 TREINO_DESLIGADO` | `TREINO_DESLIGADO` |
| `401` (assinatura) | `INDISPONIVEL` + log `[atendente:treino] assinatura_recusada` (segredo diferente nos dois lados) |
| `403 PAPEL_NAO_PERMITIDO` | `NAO_PERMITIDO` |
| `404` em sessão/versão/observação/nota | `NAO_ENCONTRADO` |
| `409 SESSAO_ENCERRADA` · `409 SESSAO_CHEIA` | o mesmo código |
| `422 TEXTO_LONGO` | `TEXTO_LONGO` |
| `429 LIMITE_SESSOES` | `LIMITE_SESSOES` |
| `200` com corpo que não passa no Zod, outro status, timeout, rede | `INDISPONIVEL`, motivo só no log |

## 4. Zod (`contracts/autoatendimento/treino.ts`)

Requests com `.strict()`. **Respostas do agens sem `.strict()`** (o padrão do Zod descarta campo
desconhecido): o agens pode acrescentar campo sem quebrar o Eliza (C32). A forma espelha a
`specs/06 §5.1`; onde divergirem, **a spec do agens vence** e este arquivo é corrigido.

```ts
export const CampoPerfil = z.enum([
  "tratamento", "saudacoes", "despedidas", "emojis.uso", "emojis.preferidos", "emojis.evitar",
  "pontuacao.exclamacao", "pontuacao.reticencias", "pontuacao.risada", "comprimento",
  "vocabulario.preferir", "vocabulario.evitar", "tom", "exemplos",
])

export const Perfil = z.object({
  tratamento: z.enum(["voce", "senhor", "pelo_nome"]).nullable(),
  saudacoes: z.array(z.string()).max(5),
  despedidas: z.array(z.string()).max(5),
  emojis: z.object({
    uso: z.enum(["nunca", "pouco", "frequente"]).nullable(),
    preferidos: z.array(z.string()).max(8),
    evitar: z.array(z.string()).max(8),
  }),
  pontuacao: z.object({
    exclamacao: z.enum(["rara", "normal", "muita"]).nullable(),
    reticencias: z.boolean().nullable(),
    risada: z.boolean().nullable(),
  }),
  comprimento: z.enum(["curto", "medio"]).nullable(),
  vocabulario: z.object({ preferir: z.array(z.string()).max(15), evitar: z.array(z.string()).max(15) }),
  tom: z.array(z.string()).max(5),
  exemplos: z.array(z.object({ cenario: z.string(), resposta: z.string() })).max(8),
})

export const RespostaSessao = z.object({ sessaoId: z.string(), resposta: z.string(), nova: z.boolean() })
export const RespostaMensagem = z.object({
  resposta: z.string(), ensaiosFeitos: z.number().int(), sugerirEncerrar: z.boolean(),
})
export const Mudanca = z.object({ campo: z.string(), antes: z.unknown(), depois: z.unknown() })
export const RespostaEncerrar = z.object({
  versaoNova: z.number().int().nullable(),
  mudancas: z.array(Mudanca),
  aguardandoEvidencia: z.array(z.object({ campo: z.string(), valor: z.string(), sessoes: z.number(), faltam: z.number() })),
  notasNovas: z.array(z.object({ id: z.string(), texto: z.string() })),
  extracaoPendente: z.boolean().optional(),
})
export const PerfilAtivo = z.object({ versao: z.number().int(), perfil: Perfil, secaoPrompt: z.string() })
export const VersaoResumo = z.object({
  versao: z.number().int(), ativa: z.boolean(), origem: z.string(), criadaEm: z.string(), mudancas: z.array(Mudanca),
})
export const Observacao = z.object({
  id: z.string(), campo: z.string(), valor: z.string(), origem: z.enum(["extraida", "declarada", "metrica"]),
  estado: z.enum(["candidata", "rejeitada"]), sessoes: z.number().int(), elegivel: z.boolean(), citacao: z.string().nullable(),
})
export const Nota = z.object({
  id: z.string(), texto: z.string(), citacao: z.string().nullable(),
  estado: z.enum(["pendente", "aplicada", "descartada"]), criadaEm: z.string(),
})
export const RespostaPrevia = z.object({ resposta: z.string(), versao: z.number().int() })

export const TEXTO_TREINO_MAX = 1000   // igual a treino.limites.texto_max do agens
export const MensagemTreinoBody = z.object({ texto: z.string().trim().min(1).max(TEXTO_TREINO_MAX) }).strict()
export const PreviaBody = z.object({ fala: z.string().trim().min(1).max(500), versao: z.number().int().optional() }).strict()
```

## 5. Server actions (`app/actions/atendente-treino.ts`) e página

Cada action: verificações da §1 → monta `Operador` → `chamarTreino` → devolve
`{ ok: true, dados } | { ok: false, erro }`. Sem `revalidatePath` (a página é cliente e recarrega o
que precisa).

| Action | Chama (specs/06 §5) | Ticket de visitante |
|---|---|---|
| `abrirSessaoTreino()` | `POST /sessoes` | sim, se o 08 existir |
| `enviarMensagemTreino(sessaoId, texto)` | `POST /sessoes/{id}/mensagens` | sim, se o 08 existir |
| `encerrarSessaoTreino(sessaoId)` | `POST /sessoes/{id}/encerrar` | não |
| `lerPerfil()` · `listarVersoes()` · `listarObservacoes()` · `listarNotas()` | os `GET` | não |
| `ativarVersao(n)` | `POST /perfil/versoes/{n}/ativar` | não |
| `rejeitarObservacao(id)` · `restaurarObservacao(id)` | `POST /observacoes/{id}/...` | não |
| `aplicarNota(id)` · `descartarNota(id)` | §5.5 | não |
| `previaAtendente(fala, versao?)` | `POST /previa` | **obrigatório** |
| `zerarPerfil()` | `DELETE /perfil` | não |

**Ticket de visitante** (C33): `emitirTicketVisitante({ org, sess: randomUUID() })` do contrato 08, um
novo por chamada, mandado no corpo como `ticketVisitante` e nunca devolvido ao navegador (C14).

### 5.1 Página

`app/(app)/configuracoes/atendente/page.tsx` (server component: verificações da §1, primeiro nome do
operador e dados iniciais) + componentes cliente em `components/atendente-treino/`. Link na página de
configurações: card "Treinar atendente" na aba WhatsApp, visível nas condições da §1.

Cinco abas (`Tabs`). **Atenção** (armadilha conhecida do Radix): `TabsContent` sem `forceMount`
desmonta a aba inativa. O estado da conversa de treino tem de viver **acima** das abas (no componente
da página), senão trocar de aba apaga o chat.

### 5.2 Aba "Treinar"

- Texto de abertura, fixo: "O atendente vai fazer de conta que é um cliente. Responda como você
  responderia de verdade, do seu jeito. **Não use dados reais de clientes.**"
- Botão "Começar treino" → `abrirSessaoTreino`. Com sessão aberta, o chat: bolhas do agens à
  esquerda (a fala de cliente vem entre aspas; mostrar como está), do operador à direita; campo de
  texto com contador até `TEXTO_TREINO_MAX`; Enter envia, Shift+Enter quebra linha; enquanto espera,
  "digitando…" e campo desabilitado.
- `sugerirEncerrar = true` → destaque no botão "Encerrar e aprender".
- Encerrar → `encerrarSessaoTreino` → painel de resultado com `RespostaEncerrar`: "Aprendi" (cada
  `mudanca` em linguagem simples, §5.7), "Ainda confirmando" (`aguardandoEvidencia`: "vi 1 vez, preciso
  ver de novo em outro treino"), "Fatos para você decidir" (`notasNovas`, com atalho para a aba Notas).
  `versaoNova = null` sem mudanças → "Nada novo desta vez." `extracaoPendente` → "Ainda estou
  processando; volte em alguns minutos."
- A conversa da sessão fica só no estado da página. Recarregar e abrir de novo devolve a mesma sessão
  aberta (`nova: false`), com a última fala do agens, não o histórico inteiro (o agens não expõe o
  histórico; C36).

### 5.3 Aba "O que aprendi"

- `lerPerfil` → o perfil em linguagem simples (§5.7) e, num `<details>` "Como isto entra no
  atendente", o `secaoPrompt` em fonte monoespaçada, só leitura.
- `listarObservacoes` → lista por campo: elegíveis ("em uso"), candidatas ("confirmando"), rejeitadas
  ("removidas"); cada item com `citacao` (quando houver) e o botão **Remover** (`rejeitar`) ou
  **Voltar a usar** (`restaurar`). Remover pede confirmação: "O atendente para de usar isto e não volta
  a aprender sozinho."
- Botão "Começar do zero" → confirmação forte (digitar "ZERAR") → `zerarPerfil`.

### 5.4 Aba "Versões"

`listarVersoes`: versão, data, origem em texto ("treino de 27/10", "voltou para a v3", "edição",
"começou do zero"), mudanças. Na não ativa, "Usar esta versão" → confirmação → `ativarVersao(n)`; a
resposta lista os padrões que foram removidos junto, com atalho para a aba "O que aprendi".

### 5.5 Aba "Notas" e `aplicarNota`

`listarNotas` pendentes primeiro. Cada nota com o texto, a citação e os botões **Adicionar às
instruções do atendente** e **Descartar**. Explicação fixa: "Isto é informação do seu negócio, não
jeito de falar. O atendente só usa depois que você adicionar. Confira se está certo."

`aplicarNota(id)`, em ordem (C34):

1. verificações da §1; busca a nota em `GET /notas` (pendente e do tenant; senão `NAO_ENCONTRADO`);
2. lê `instrucoes_atendimento` da org (service role);
3. **idempotente:** se a linha `- {texto}` já está nas instruções, pula para o passo 5;
4. novo valor = atual (sem espaço no fim) + (atual vazio ? "" : "\n") + `- {texto}`; se passar de
   **2.000** caracteres (CHECK da coluna), devolve `LIMITE_INSTRUCOES` sem gravar; senão grava com
   service role (`createAdminClient`), filtrando por `organization_id`;
5. `POST /notas/{id}/marcar { estado: "aplicada" }`. Falhou → devolve `{ ok: true, aviso:
   "MARCACAO_PENDENTE" }`: a instrução já vale; a nota continua pendente na lista e reaplicar não
   duplica (passo 3).

`descartarNota(id)`: só o passo 5 com `descartada`.

A tela mostra as instruções resultantes depois de aplicar. **Ainda não existe** tela para editar
`instrucoes_atendimento` diretamente (01: "na F0 a escrita é pelo Studio"); este contrato não cria
uma.

### 5.6 Textos de erro

| `ErroTreino` | Texto |
|---|---|
| `INDISPONIVEL` · `TREINO_DESLIGADO` | "O treino está indisponível agora. Tente de novo em alguns minutos." |
| `NAO_PERMITIDO` | "Só o dono ou um admin pode treinar o atendente." |
| `NAO_ENCONTRADO` | "Isso não existe mais. Recarregue a página." |
| `SESSAO_ENCERRADA` | "Este treino já terminou. Comece outro." |
| `SESSAO_CHEIA` | "Este treino ficou longo. Encerre para eu aprender o que já vi." |
| `TEXTO_LONGO` | "Mensagem longa demais (até 1.000 caracteres)." |
| `LIMITE_SESSOES` | "Você já fez muitos treinos hoje. Volte amanhã." |
| `LIMITE_INSTRUCOES` | "As instruções do atendente já estão cheias (2.000 caracteres). Peça ao suporte para revisar." |

### 5.7 Linguagem simples do perfil

Função pura `descreverPerfil(perfil) → string[]` em `components/atendente-treino/descrever.ts`, com
teste: "Trata o cliente por **você**", "Usa emojis **com frequência**: 💅 ✨", "Nunca usa: 😂",
"Exclamação: **normal**", "Mensagens **curtas**", "Tom: carinhosa, informal", "Costuma cumprimentar
com: “Oii flor!”". Campo vazio é omitido. Mesma função descreve `mudancas` (antes → depois).

### 5.8 Aba "Prévia"

Só com o contrato 08 executado (senão a aba não aparece). Campo "Escreva como um cliente escreveria"
(até 500) + seletor de versão (padrão: ativa) → `previaAtendente` → mostra a resposta como bolha de
WhatsApp. Aviso fixo: "Prévia: nada é enviado nem marcado. O atendente vê o catálogo real só para
leitura."

## 6. O que não muda

- A API de Autoatendimento (rotas, Zod, OpenAPI, versão `1`).
- O encaminhamento do WhatsApp e o contrato 09.
- `autoatendimento_config`: nenhuma coluna nova; `instrucoes_atendimento` só ganha linhas por §5.5.
- Org sem o add-on: nada aparece, nenhuma chamada sai.

## 7. Ordem de execução

1. Env (`.env.example`, `DEPLOY.md`).
2. Zod (`treino.ts`) → `lib/autoatendimento/treino.ts` com testes de assinatura (vetor fixo:
   segredo, timestamp e corpo conhecidos → hex esperado; o mesmo vetor entra nos testes do agens) e
   de tradução de erro com `fetch` falso.
3. Server actions com testes das verificações da §1 (papel `professional`/`staff` → `NAO_PERMITIDO`
   sem chamar o agens; add-on inativo → idem) e do `aplicarNota` (idempotência, limite de 2.000,
   marcação que falha).
4. `descreverPerfil` com testes.
5. Página e componentes, contra um agens falso (servidor local que responde os JSON da `specs/06 §5.1`).
6. `tsc`, `lint`, `build`.
7. Integração com o agens real só depois da F2c do sola-agens: aceite da §8.

## 8. Aceite

**Acesso**
- [ ] Owner e admin de org com add-on ativo veem o card e a página; `professional` e `staff` não
      (página → 404).
- [ ] Org sem add-on: nem card nem página.
- [ ] Action chamada direto (sem a página) por `staff` → `NAO_PERMITIDO`, nenhuma chamada ao agens.
- [ ] Nenhuma resposta ao navegador contém segredo ou ticket.

**Treino**
- [ ] Começar → fala de abertura do agens; recarregar a página e começar de novo → mesma sessão.
- [ ] Trocar de aba no meio do treino não apaga o chat.
- [ ] Mensagem com 1.001 caracteres → bloqueada no campo e `TEXTO_LONGO` se forçada.
- [ ] Encerrar → painel de resultado; nova versão aparece em "Versões" e em "O que aprendi".
- [ ] Agens fora do ar → texto de `INDISPONIVEL`, sem erro técnico na tela.

**Perfil e versões**
- [ ] Remover um padrão → some de "em uso"; o próximo treino não o traz de volta sozinho.
- [ ] Voltar para uma versão anterior → ela vira a ativa; a lista do que foi removido junto aparece.
- [ ] Começar do zero exige digitar "ZERAR".

**Notas**
- [ ] Aplicar → linha `- {texto}` no fim de `instrucoes_atendimento`; nota sai de pendentes.
- [ ] Aplicar a mesma nota de novo (ex.: depois de `MARCACAO_PENDENTE`) não duplica a linha.
- [ ] Instruções a ponto de passar de 2.000 → `LIMITE_INSTRUCOES`, nada gravado.
- [ ] Descartar → sai de pendentes; instruções intactas.

**Prévia** (com o 08)
- [ ] Resposta no estilo do perfil, com o catálogo real; nenhum agendamento criado, nenhuma
      mensagem de WhatsApp enviada.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| C28 | **Página própria `/configuracoes/atendente`**, com link na aba WhatsApp | Nova aba em `/configuracoes` | São cinco telas (chat, perfil, versões, notas, prévia); dentro de uma aba viram abas aninhadas e o chat perderia espaço. `equipe` e `horarios` já são subpáginas |
| C29 | **Server actions**, sem rota HTTP nova | `app/api/atendente/treino/*` | Mesmo padrão do `whatsapp-connect.ts` (autorização por papel dentro da action); nada novo exposto na internet. A `specs/06 §12` falava em rotas; o que importa lá é o navegador nunca falar com o agens, e vale igual |
| C30 | **Sem coluna `treino_ativo`**: treina quem tem o add-on ativo | Coluna para ligar o treino por org | Treino sem atendente não tem uso; uma chave a menos para lembrar. Se um dia o treino virar plano pago à parte, a coluna entra numa revisão aditiva |
| C31 | **Segredo próprio** `ATENDENTE_TREINO_SECRET` | Reaproveitar `ATENDENTE_ENCAMINHAMENTO_SECRET` | S9 do agens: a chave das mensagens não pode mudar o estilo de todos os atendimentos |
| C32 | **Respostas do agens sem `.strict()`**; requests com | Tudo `.strict()` | O agens evolui sozinho (o perfil vai ganhar campos); `.strict()` na resposta derrubaria a tela a cada campo novo. Request estrito protege o agens de lixo do Eliza |
| C33 | **Ticket de visitante novo por chamada** (`sess` aleatório), só para ensaio e prévia | Ticket próprio do treino; sem catálogo | Reaproveita o 08 sem criar tipo de ticket; o visitante já é restrito a catálogo e horários, que é tudo o que o ensaio e a prévia precisam |
| C34 | **Aplicar nota grava primeiro no Eliza, depois marca no agens; idempotente por texto** | Marcar primeiro; transação distribuída | Se a marcação falhar, o pior caso é a nota continuar na lista, e reaplicar não duplica. O contrário (marcada sem gravar) perderia a informação |
| C35 | **Não toca a API de Autoatendimento**; versão continua `1` | — | O treino é outra API (do agens), consumida pelo Eliza; nada muda para quem usa a de Autoatendimento |
| C36 | **Histórico da sessão não é recuperável na tela** depois de recarregar | Rota no agens para listar mensagens da sessão | Treino é curto; a perda é só visual (o agens tem tudo). Se fizer falta, é uma rota a mais no agens, aditiva |

## 10. Fora deste contrato

- Editar `instrucoes_atendimento`, persona e respostas fixas pelo painel (continua pelo Studio).
- Treino por áudio; perfil por profissional.
- Aprender das respostas reais da equipe (`deMim`): v2 do agens, com decisão de LGPD própria (T6).
- Treino para orgs sem o add-on de WhatsApp (ex.: só canal web): revisão aditiva quando houver.
