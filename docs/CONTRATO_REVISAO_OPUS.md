# Contrato — Revisão e fechamento da refatoração visual

> **Segunda etapa.** A primeira (`CONTRATO_REFATORACAO_VISUAL.md`) foi executada
> por um modelo mais barato e cobriu o trabalho mecânico. Esta etapa faz o que
> exige julgamento: auditar aquilo, resolver os casos ambíguos que foram
> deliberadamente adiados, e decidir o que ainda entra.

- **Branch**: `development`, em cima do trabalho da primeira etapa.
- **Este contrato é diferente do primeiro de propósito.** O anterior dizia
  exatamente o que digitar, porque o executor não devia decidir nada. Aqui é o
  contrário: você recebe **critério e prioridade**, e é esperado que julgue. Onde
  este documento der um valor fechado, use o valor. Onde der um critério, aplique
  o critério — não peça confirmação para cada ocorrência.
- **Você pode discordar deste contrato.** Se uma instrução aqui estiver errada
  diante do código, o código vence: registre a divergência e siga o que é correto.

---

## R0 — Entrada

Antes de tocar em qualquer arquivo:

1. Leia `docs/RELATORIO_FASE_SONNET.md`. **Trate como relato, não como verdade.**
   O que ele diz que foi feito precisa ser conferido; o que ele não menciona é
   justamente onde costuma estar o problema.
2. Leia `CONTRATO_REFATORACAO_VISUAL.md` inteiro — especialmente §4 (decisões
   D1–D6). Elas continuam valendo, exceto onde R3 as revisar.
3. Leia `docs/PESQUISA_NICHOS_VISUAL.md` (pesquisa de mercado por nicho, insumo
   de R3). Se não existir, R3 fica bloqueado — faça o resto e registre.
4. O item 2.1 (tabela de cores por nicho) **esteve bloqueado e foi liberado**
   antes da execução, com a pesquisa já incorporada. Confirme que o código reflete
   a tabela final:

   ```bash
   grep -n "334.2 42.4%\|214.6 44.7%\|134 28.9%" web/app/globals.css
   ```
   → três linhas (salão, advocacia, certificado). Se vier vazio, a primeira etapa
   aplicou uma tabela desatualizada — isso é defeito, corrija em R1.
5. `git log --oneline` na `development`: deve haver um commit por fase. Se as fases
   vieram amontoadas num commit só, registre — atrapalha a auditoria mas não
   impede.

---

## R1 — Auditoria do trabalho da primeira etapa

Conferir independentemente, não pelo relatório.

```bash
cd web
npx tsc --noEmit && npx eslint .
grep -rn "var(--brand))\|brandVars\|setupStylesByNiche\|NicheBrandConfig" .
grep -rn "Inter\|Stethoscope" app/layout.tsx app/login/
ls public/*.svg app/favicon.ico 2>/dev/null
```

Com `npm run dev`, nos **dois temas** e em **mobile e desktop**:

`/login` · `/setup` · `/demo/start` · `/dashboard` · `/agendamentos` · `/clientes` ·
`/clientes/[id]` · `/servicos` · `/configuracoes` · `/marcar/[slug]`

E no console, logado numa org de cada nicho:

```js
getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')
document.querySelectorAll('[class*="theme-"]').length
```

**Rubrica — o que é defeito e o que não é:**

| Achado | Veredito |
|---|---|
| Token de nicho ainda com o valor **antigo e saturado** | Esperado se 2.1 estava bloqueado (ver R0.4). É R3, não defeito. |
| Token com valor que não bate com nenhuma das duas tabelas | Defeito. Corrigir. |
| Índigo `#6467F2` sobrevivendo em `:root` | Defeito. 2.2 estava liberado. |
| Cor fixa **nova**, introduzida pela primeira etapa | Defeito. Corrigir. |
| Cor fixa **preexistente** ainda no lugar | Esperado. É R2. |
| `setup-form.tsx` / `demo-niche-picker.tsx` meio migrados | Esperado e documentado. É R2. |
| Contraste abaixo de 4,5:1 em texto | Defeito, sempre. Corrigir. |
| Bloco com fundo do tema errado | Defeito. Corrigir. |
| Escolha estética que você faria diferente, mas que segue o contrato | **Não é defeito.** Não refaça por gosto. |

Defeitos de R1 são corrigidos por você, em commit separado (`fix(visual): ...`),
antes de seguir para R2.

---

## R2 — Varredura semântica das cores fixas

O trabalho que foi retirado da primeira etapa. São ~463 utilitários de paleta fixa
em 40 arquivos; 64% em sete.

| # | arquivo | ocorrências (linha de base) |
|---|---|---|
| 1 | `app/setup/setup-form.tsx` | 81 |
| 2 | `components/records/service-record-list.tsx` | 46 |
| 3 | `components/dashboard/financial-cards.tsx` | 46 |
| 4 | `app/(app)/clientes/[id]/page.tsx` | 36 |
| 5 | `app/(app)/dashboard/page.tsx` | 32 |
| 6 | `components/records/service-record-form.tsx` | 27 |
| 7 | `app/demo/start/demo-niche-picker.tsx` | 11 |

Os tokens `--status-*` já existem (Fase 4.1) e habilitam `text-success`,
`bg-warning/10`, `border-danger/20` etc.

**A pergunta que você faz em cada ocorrência** — e a razão de isto não ter ido
para o modelo barato:

> Esta cor **significa** alguma coisa, ou está aqui só para não ser cinza?

Se significa → token semântico. Se não significa → ela some, e o elemento passa a
usar o token neutro ou de marca que couber. **Na dúvida, remova a cor.** Cor a
menos é reversível; ruído cromático espalhado por 40 arquivos, não.

Heurística de partida (não é tabela de substituição cega — confira o contexto):

| Padrão | Tende a virar |
|---|---|
| `emerald-*` / `green-*` em pago, concluído, ativo, confirmado | `success` |
| `amber-*` / `yellow-*` em pendente, aguardando, vence em | `warning` |
| `red-*` / `rose-*` em cancelado, erro, campo obrigatório | `danger` |
| `red-*` em botão de excluir/remover | `destructive` (é ação, não status) |
| `blue-*` / `sky-*` rotulando informação | `info` |
| `purple-*` / `violet-*` / `indigo-*` | quase sempre decoração → remover a cor |
| neutros (`zinc`/`gray`/`slate`/`stone`) | `surface-*`, `muted`, `border`, `foreground`, `muted-foreground` |

Preservar sufixo de opacidade: `bg-emerald-500/10` → `bg-success/10`.

> ⚠️ **`text-brand` sobre `bg-brand-soft` reprova em barbearia** (3,57:1). A
> utilidade `.bg-brand-soft` já traz o próprio `color`; não some `text-brand` por
> cima. Vale para os chips de KPI e para qualquer superfície tingida de marca.

**Dois casos que merecem atenção específica:**

1. **Chips de KPI do dashboard** (`app/(app)/dashboard/page.tsx`, ~linhas 291,
   327, 364, 387, 417). Quatro cores diferentes — âmbar, roxo, verde, azul — para
   quatro métricas que não têm relação semântica com cor nenhuma. É o sinal mais
   forte de "dashboard de template" na tela. Unifique num tratamento só. Continua
   valendo D4: a cor do nicho não significa status.
2. **`service-record-list.tsx` e `financial-cards.tsx`** concentram status
   financeiro real (pago / pendente / cancelado). Aqui a cor **significa**, e a
   consistência entre os dois arquivos importa mais que em qualquer outro lugar —
   hoje `emerald` e `green` são usados para a mesma coisa em pontos diferentes.

**Aceite de R2**

- [ ] Nos 7 arquivos: `grep -crE "(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}"` → 0
- [ ] Contagem global cai de ~463 para menos de 170
- [ ] "Pago" tem a mesma cor em todos os lugares onde aparece
- [ ] Nenhum estado depende **só** de cor — há também rótulo, ícone ou forma
- [ ] Todo par texto/fundo introduzido passa 4,5:1 nos dois temas

---

## R3 — Conferir a incorporação da pesquisa

**Mudou de natureza.** A pesquisa (`docs/PESQUISA_NICHOS_VISUAL.md`) chegou antes
da execução e já foi incorporada à tabela da Fase 2.1. Isto aqui não é mais
"decidir a tabela" — é **conferir na tela** o que foi decidido no papel, e resolver
as três ressalvas que a pesquisa deixou em aberto de propósito.

**R3.1 — Conferir o que foi aplicado.** Abra os 8 nichos e verifique que a cor e o
raio batem com a tabela. Depois, o que só se vê rodando:

- **Salão** subiu para 5,6:1 e o raio caiu para 0.5rem. O raio muda a percepção
  mais do que a cor — confira se o nicho não ficou seco demais para o segmento.
- **Certificado** e **advocacia** foram movidos para descolar dos tokens de status.
  Coloque na mesma tela um chip de status e um elemento de marca: eles precisam ser
  distinguíveis. A separação calculada é ΔE ≥ 19, o que é suficiente na teoria e
  merece confirmação visual.
- **Barbearia** é o par mais apertado de todos (ΔE 19,1 entre a cor de marca e
  `--status-danger`). Se algo ali ficar ambíguo, é aqui.

**R3.2 — As três ressalvas em aberto.** A pesquisa levantou e não resolveu:

| Ressalva | O que a pesquisa achou | Decisão que sobra |
|---|---|---|
| **Psicologia** | Os quatro softwares de gestão para psicólogo no Brasil são teal/navy sobre creme, nenhum é roxo. Roxo é convenção do lado B2C (Zenklub), não B2B. Foi mantido porque teal colidiria com tatuador | O ganho real seria a **superfície creme** (`#F6F4EF`, já existe em `marketing/src/base.css`), não o hex. Isso exigiria emenda ao D6 e afeta todos os nichos. **Avalie e decida** |
| **Tatuador** | Os três sistemas brasileiros usam cor default de framework (violet-500, Bootstrap blue). Não há convenção. O único sinal real é fundo escuro, que o D6 barra | Mantido por ausência de contra-evidência, **não por validação**. Registre isso como dívida conhecida |
| **Salão continua rosa** | A convenção B2B brasileira é coral/laranja (Trinks, Avec, Gendo). Ficou rosa por razão **interna**: coral colaria com o bronze da barbearia | A justificativa "rosa/glamour" do `MARKETING.md` não tem lastro externo. Ou aceite a razão interna e corrija o texto, ou repense o par barbearia/salão junto |

Nenhuma das três é obrigatória. Todas merecem uma linha no relatório dizendo o que
você decidiu e por quê — inclusive "deixei como está".

**R3.3 — Sincronizar o `MARKETING.md`.** A tabela dele está desatualizada em quatro
valores. As duas fontes não podem divergir, ou o próximo agente reabre a discussão.

**Aceite de R3**

- [ ] Os 8 nichos conferidos na tela, não só no CSS
- [ ] Marca e status distinguíveis lado a lado nos nichos apertados
- [ ] `MARKETING.md` sincronizado com a tabela final
- [ ] As três ressalvas têm decisão registrada

## R4 — Os pedaços faltando

Estão em `CONTRATO_REFATORACAO_VISUAL.md` §8, mapeados e adiados. **Você decide
quais entram agora**, com este critério: entra o que é barato e melhora
credibilidade externa; fica o que é caro e depende de uso real.

Contexto para calibrar: o produto está em produção, com zero clientes pagantes.
A prioridade declarada é achar usuários dispostos a testar. Trabalho que atrase
isso precisa se justificar.

Recomendação inicial — reavalie com o que você viu em R1:

| Item | Recomendação | Por quê |
|---|---|---|
| Uploads duplicados em `public-booking-form.tsx` (dropzone bom na ~928, `<Input type="file">` cru na ~1171, e é o cru que o paciente vê) | **Entra** | É remover duplicata, não construir. Barato e visível na tela de maior exposição |
| Dois `<h1>` concorrentes na página pública | **Entra** | Uma linha |
| Stepper cortando rótulo no mobile | **Entra** | A maioria dos pacientes agenda pelo celular |
| Aviso de LGPD na página que coleta CPF/RG e laudo | **Entra** | Coleta dado sensível de saúde sem aviso. Se houver dúvida jurídica, escale em vez de redigir texto legal por conta própria |
| Bloco de documentos dominando a coluna antes de escolher o serviço | **Avalie** | É reordenação de fluxo — mais perto de produto que de visual |
| Preâmbulo de ~600px antes do primeiro campo no mobile | **Avalie** | Idem |
| Rótulos truncados na tab bar mobile | **Entra se for trivial** | Se exigir repensar a navegação, fica |
| Chrome do dashboard: nome da org 3×, chips "ORGANIZAÇÃO"/"CARGO" | **Fica** | Decisão de arquitetura de informação, merece sessão própria |

**Regra que continua valendo**: nada de mudança em query, action, RLS ou migration.
Se um item exigir isso, ele sai do escopo — não o force.

Registre explicitamente o que você decidiu deixar de fora e por quê. Uma lista de
"não fiz" com motivo vale mais que silêncio.

---

## R5 — Fechamento

1. **Corrigir o `MARKETING.md`.** Ele afirma que a identidade por nicho está "já
   implementada em código" / "já em produção", e que o fallback índigo "não vazou
   pra produção". Ambas eram falsas — o índigo renderizava em todas as telas
   logadas e em todas as páginas públicas de agendamento. Reescreva o trecho
   descrevendo o estado real pós-refatoração.
2. **Atualizar `docs/CHANGELOG.md`** no padrão que o arquivo já usa.
3. **Verificação final**: as 10 rotas de R1, nos dois temas, em mobile e desktop,
   percorridas de novo depois de tudo. Regressão em R2/R3/R4 é o risco real desta
   etapa — os tokens mexem em tela que ninguém abriu.
4. **Não fazer merge em `main`.** Entregue a `development` pronta e diga o que
   falta para o merge.

**Entrega**: `docs/RELATORIO_REVISAO_OPUS.md`, cobrindo:

- defeitos encontrados em R1 e o que foi corrigido;
- o que R2 mudou, com a contagem antes/depois;
- os 8 vereditos de R3 e as recomendações da pesquisa que você **rejeitou**, com motivo;
- o que entrou e o que ficou de fora em R4, com motivo;
- o que continua pendente e o que você recomenda como próximo passo.

Seja específico sobre o que **não** ficou bom. Um relatório que só lista sucesso é
um relatório que o revisor humano não pode usar.

---

## Fora de escopo, ainda

- Redesenhar a marca ou criar símbolo (ver `CONTRATO_REFATORACAO_VISUAL.md` §7).
- Criar `app/page.tsx` / landing page.
- Qualquer mudança em `supabase/`.
- Trocar biblioteca de componentes ou introduzir dependência nova.
- Reescrever `public-booking-form.tsx` inteiro. R4 autoriza correções pontuais
  nele, não refatoração estrutural do arquivo.
