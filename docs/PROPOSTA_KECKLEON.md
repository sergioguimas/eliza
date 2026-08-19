# Proposta — Costura do Keckleon

> **Status**: proposta, não contrato. Para executar **depois** que a refatoração
> visual (`CONTRATO_REFATORACAO_VISUAL.md` + `CONTRATO_REVISAO_OPUS.md`) fechar.
> Não misturar com aquele trabalho: são riscos de natureza diferente.

---

## 1. O que o Keckleon é hoje

Não é um motor. São **cinco mecanismos paralelos** chaveados pela mesma string
(`organizations.niche`), morando em lugares diferentes, com disciplinas diferentes:

| Eixo | Onde mora | Tipo da chave | Passa pelo provider | Consumidores |
|---|---|---|---|---|
| Linguagem | `lib/dictionaries/` (8 seções, 256 chaves) | união literal | Sim | **45 arquivos** |
| Ícones | `components/shared/category-icon.tsx` (8 `IconMap`) | `Record<string, …>` | Sim | 5 |
| Metadado | `lib/niche-config.ts` | `Record<string, …>` | Sim | 6 |
| Documentos | `lib/niche-documents.ts` | `Record<string, …>` | **Não** — direto | 1 |
| Visual | `app/globals.css`, blocos `.theme-*` | — (CSS) | **Não** — cascata | todo o app |

Há ainda um sexto eixo fantasma: `icon_set`, declarado no tipo do dicionário
(`dictionaries.ts:8`) e **nunca lido por ninguém**.

**O que está bom e deve virar o núcleo**: o `buildNiche` de `niches.ts`. Ele faz
concordância de gênero (`gender`, `servico_gender`), derivação de minúscula inicial
e plural em português. Isso é motor de linguagem de verdade, não um mapa de
strings. É o ativo real do Keckleon.

**O que está bom e ninguém percebeu**: o `iconRegistry` do `CategoryIcon` já tem
registro central com fallback em cascata (`icons[name] ?? fallback ?? generico ??
Briefcase`). É o eixo mais bem construído dos cinco — e serve de modelo.

---

## 2. Por que os defeitos aconteceram

Os três problemas que a refatoração visual encontrou têm **uma causa comum**:

- `advocacia` era ardósia em três fontes e **rosa** numa quarta;
- `generico` era quase-preto em duas fontes e **índigo** numa terceira;
- `icon_set` foi declarado e esquecido.

A causa não é desatenção. É que **nada obriga um nicho a estar completo**. Três dos
cinco eixos são `Record<string, X>` — chave `string` aceita qualquer coisa e não
exige nada. Adicionar um nicho significa lembrar de cinco arquivos, e o TypeScript
não reclama se você esquecer três.

> **A correção mais barata de toda esta proposta é uma linha:**
> trocar `Record<string, X>` por `Record<NicheId, X>`.
>
> Com `NicheId` sendo a união literal dos 8 ids, o build passa a falhar quando um
> nicho falta em qualquer eixo. Zero dependência nova, roda no `npx tsc --noEmit`
> que já está no fluxo. Como o projeto **não tem infraestrutura de teste nenhuma**,
> o compilador é a única rede disponível — e é suficiente para esta classe de erro.

---

## 3. A regra de fronteira

Antes de expandir, decidir o que o motor pode governar. A regra proposta:

> ### O Keckleon varia **o quê** aparece. Nunca **como** aparece.

| Pertence ao Keckleon | Não pertence |
|---|---|
| Como a coisa se chama (paciente / cliente / assistido) | Estilo do card |
| Quais campos existem no prontuário | Espaçamento, sombra, elevação |
| Quais documentos são pedidos | Layout e grid |
| Quais etapas o agendamento tem | Tipografia |
| Quais ícones representam cada seção | Densidade |
| Quais métricas o dashboard mostra | Cor e raio (isso é CSS, ver §5) |

**Por que a linha fica aí.** Variar estilo por nicho cria **oito design systems**
para manter e testar: toda mudança de UI passa a custar 8×, num time pequeno. E
contraria o que o próprio `MARKETING.md` define — *"o que fica constante entre
marca institucional e todos os nichos: tipografia e estrutura de layout"*. É a
estrutura constante que faz continuar parecendo Eliza por baixo de qualquer cor.
Cor e raio já dão diferenciação suficiente, e custam um token.

Variar **conteúdo** é o oposto: a diferença é real. Psicólogo precisa de evolução
de sessão (o CFP exige registro), clínica precisa de anamnese, tatuador precisa de
referência e cicatrização, advogado precisa de processo e prazo. Barbearia não
precisa de quase nada. É isso que separa a Eliza de uma agenda genérica.

---

## 4. Arquitetura proposta

### 4.1 — Um módulo por nicho, atrás da API atual

```
lib/keckleon/
  types.ts          NicheId (união literal) + o contrato NicheModule
  build.ts          buildNiche — a derivação de gênero/plural, sem mudança
  registry.ts       Record<NicheId, NicheModule> — completude no compilador
  niches/
    generico.ts     linguagem + ícones + documentos, tudo do nicho num lugar
    clinica.ts
    psicologia.ts
    barbearia.ts
    salao.ts
    advocacia.ts
    certificado.ts
    tatuador.ts
```

Cada `niches/<id>.ts` declara **todos os eixos daquele nicho** e exporta um objeto
tipado. Adicionar um nicho passa a ser **um arquivo**, não cinco.

O contrato:

```ts
export type NicheId =
  | 'generico' | 'clinica' | 'psicologia' | 'barbearia'
  | 'salao' | 'advocacia' | 'certificado' | 'tatuador'

export type NicheModule = {
  id: NicheId
  meta: NicheMeta            // label, description, appTitle, sidebarLabel
  language: NicheLanguage    // o config compacto que hoje vai pro buildNiche
  icons: IconMap             // os 6 ícones de categoria
  documents: NicheDocument[] // pode ser [], mas precisa estar declarado
}

export const registry: Record<NicheId, NicheModule> = { … }
```

### 4.2 — A API pública não muda

**Esta é a restrição que torna a costura segura.** 45 arquivos consomem
`useKeckleon().dict` e `getDictionary(niche)`. Nenhum deles pode ser tocado.

`getDictionary`, `useKeckleon`, `getNicheMetadata`, `getNicheDocuments` e
`CategoryIcon` continuam existindo com a mesma assinatura e o mesmo retorno —
passam apenas a ler do registro em vez de cinco mapas soltos. É rebobinar a fiação
atrás de uma fachada estável.

Consequência prática: dá para fazer a costura inteira **sem alterar um único
componente**, e verificar com `npx tsc --noEmit` + as telas.

### 4.3 — O que fica de fora: a cor

Os blocos `.theme-*` **continuam em CSS**. Não gerar CSS a partir do TypeScript.

Razões: variável CSS cascateia para todo filho, inclusive Server Component e
inclusive a página pública que não tem provider; um pipeline TS→CSS adiciona etapa
de build e uma classe nova de bug de sincronia, em troca de nada.

O que muda é o **seam**: um script `npm run check:niches` (~20 linhas, sem
dependência) confere que todo `NicheId` do registro tem um `.theme-<id>` no
`globals.css` e vice-versa. É a única costura que o compilador não alcança.

---

## 5. Migração — quatro passos, cada um seguro sozinho

Cada passo compila e é entregável. Nenhum é irreversível.

**Passo 1 — Fechar os tipos.** Criar `NicheId` e trocar os três
`Record<string, X>` por `Record<NicheId, X>`. Deletar `icon_set`.
*Não move arquivo nenhum.* Se algum nicho estiver faltando em algum eixo, o build
falha — e é exatamente o que se quer descobrir. **~1h.**

**Passo 2 — Criar o registro.** Montar `lib/keckleon/` com os 8 módulos, movendo o
conteúdo que hoje está espalhado. As funções públicas passam a ler do registro.
Nenhum componente é tocado. **~3h.**

**Passo 3 — Puxar os documentos para dentro.** `niche-documents.ts` deixa de ser
consumido direto e passa pelo registro, como os outros eixos. Um consumidor só.
**~30min.**

**Passo 4 — O guarda de CSS.** O `check:niches` no `package.json`, rodando junto do
lint. **~30min.**

**Total: ~5h.** Sem dependência nova, sem migration, sem mudança de API.

---

## 6. O que isso destrava — e que **não** faz parte desta proposta

O prontuário por nicho. Hoje `service_records` tem só `content` (texto livre) e
`tags` — o prontuário é niche-aware apenas no **nome**. Estruturar campos por nicho
é o que sustenta cobrar R$199 de clínica e R$79 de barbearia.

O caminho seria JSONB + schema por nicho vindo do registro (não coluna por nicho,
que estraga o multi-tenant). Mas isso **mexe em schema, validação, impressão e
assinatura** (`signature_hash`/`signed_at` já existem na tabela, provavelmente por
causa de CFP/CFM). É projeto próprio, com migration e risco de dado.

Fica registrado aqui como **o motivo de a costura valer a pena**, não como escopo.
Depois do Passo 2, esse projeto vira "adicionar um campo ao `NicheModule`" em vez
de "criar um sexto mecanismo paralelo".

---

## 7. O que não fazer

- **Não** gerar CSS a partir do TypeScript (§4.3).
- **Não** mudar a assinatura de `getDictionary`, `useKeckleon`,
  `getNicheMetadata`, `getNicheDocuments` ou `CategoryIcon` — 45 arquivos dependem
  delas.
- **Não** mexer no `buildNiche`. A derivação de gênero e plural está correta e é a
  parte mais difícil de reescrever. Mover de arquivo, sim; mudar a lógica, não.
- **Não** introduzir vitest/jest só para isto. O compilador resolve esta classe de
  erro; teste é outra discussão.
- **Não** expandir o motor para estilo (§3), por mais tentador que pareça.
- **Não** executar isto junto da refatoração visual. Os dois tocam
  `niche-config.ts`, e conflito de merge num arquivo que é fonte de verdade de 8
  nichos é caro de resolver.

---

## 8. Recomendação

Executar **depois** do fechamento do `CONTRATO_REVISAO_OPUS.md`, como tarefa
própria. Os Passos 1 e 4 são mecânicos e cabem num modelo barato com contrato
fechado, no mesmo formato do `CONTRATO_REFATORACAO_VISUAL.md`. Os Passos 2 e 3
mexem em fonte de verdade e merecem supervisão.

Se for necessário priorizar, **o Passo 1 sozinho já paga**: é uma hora de trabalho
e elimina de vez a classe de erro que produziu o `advocacia` rosa, o `generico`
índigo e o `icon_set` morto.
