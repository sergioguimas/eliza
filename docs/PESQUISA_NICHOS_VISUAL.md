# Pesquisa de referência visual por nicho — validação da tabela do `MARKETING.md`

> **O que este documento é**: auditoria da tabela de cores-alvo e raios-alvo do
> `MARKETING.md` ("Revisão prioritária") contra o que os concorrentes reais do
> dono de negócio brasileiro efetivamente usam. Não é uma proposta de redesign.
> Restrições aceitas sem discussão: IBM Plex Sans, identidade na tipografia/forma,
> regras da SolaSoftware, lacre `#7D2430` fora da UI diária.
>
> **Método**: `curl` no HTML + CSS de cada concorrente e extração das cores hex,
> `border-radius` e `font-family` que eles de fato declaram — não impressão de
> screenshot. Contraste calculado em WCAG 2.1 relative luminance. Data: 2026-08-19.
> Fontes por URL em cada seção. Onde não achei evidência, está escrito que não achei.

---

## Resumo executivo

Três achados dominam a decisão:

1. **Duas cores de nicho são idênticas a tokens de status do próprio contrato.**
   `.theme-certificado` = `--status-success` (`145.3 39.9% 28%` = `#2B6443`) e
   `.theme-advocacia` = `--status-info` (`213.5 28.1% 30%` = `#374A62`), valor por
   valor (`docs/CONTRATO_REFATORACAO_VISUAL.md`, linhas 269–270 vs. 357/360). Isso
   viola a decisão D4 ("a cor do nicho nunca significa status") de forma literal.
2. **Os raios-alvo estão validados — na verdade são conservadores.** Trinks roda
   `0.25rem`, Avec `3px`, Doctoralia `8px`, Aurum `8px`. A compressão proposta não é
   ousada; é alinhamento. Única exceção: salão a `0.65rem` contraria o mercado.
3. **IBM Plex Sans não é usada por nenhum dos 20 concorrentes amostrados.** A
   categoria é Inter/Poppins/system-ui. A troca já decidida é diferenciação real.

| Nicho | Cor da tabela | Veredito | Ação |
|---|---|---|---|
| Genérico | `#18181B` / 0.5rem | **Manter** | Precedente no setor (Ninsaúde `#121212`); 17,7:1 |
| Clínica | `#376BBE` / 0.55rem | **Manter** | Azul é a convenção majoritária (não unânime); 5,2:1 |
| Psicologia | `#6741AA` / 0.55rem | **Manter com ressalva** | Roxo é convenção B2C, não B2B; alternativa (teal) bloqueada por tatuador |
| Barbearia | `#B67135` / 0.3rem | **Manter** | Linha mais bem sustentada da tabela; ver limite de contraste |
| Salão | `#BC4E85` / 0.65rem | **Ajustar → `#A8446F` / 0.5rem** | 4,60:1 é margem de 0,10 sobre o piso AA; raio contraria o mercado |
| Advocacia | `#374A62` / 0.4rem | **Revisar → `#2C4A73`** | Colide com `--status-info`; baixa distinção vs. genérico |
| Certificado | `#2B6443` / 0.4rem | **Revisar → `#35603F`** | Colide com `--status-success`; verde = "válido", não marca |
| Tatuador | `#1C5F58` / 0.45rem | **Sem evidência de convenção** | Manter por ausência de contra-evidência, não por validação |

Tipografia e raio: **manter como está**. As mudanças pedidas são quatro valores de cor
e um raio.

---

## Genérico — `#18181B` / 0.5rem → **manter**

**Concorrentes / referência.** Não existe "concorrente do nicho genérico"; a
referência é o que um SaaS de agendamento brasileiro parece por padrão. Na amostra,
o padrão é azul ou roxo de template: Sinappsy `#2998ff` + `#5643fa` com Poppins
([sinappsy.com.br](https://sinappsy.com.br/)), Opero `#2563eb` (Tailwind blue-600)
([operosistemas.com.br](https://operosistemas.com.br/sistema-para-estudio-de-tatuagem)),
GestãoInk `#0d6efd` (Bootstrap default) ([gestaoink.site](https://gestaoink.site/)).

**Convenção.** Fraca por definição, e é justamente por isso que o quase-preto
diferencia. Há precedente no setor: Ninsaúde usa `#121212` sobre branco com Sora
([ninsaude.com](https://www.ninsaude.com/)) — ou seja, "preto institucional" já é uma
posição legível como software de saúde sério, não como excentricidade.

**Credibilidade.** Neutro não promete nada e não erra. Como é o tema das 8 rotas
públicas pela decisão D2 (`/login`, `/setup`, `/convite`...), é a primeira coisa que o
prospect vê antes de existir organização — quase-preto é a leitura correta ali.

**Veredito: manter.** Contraste 17,72:1 sobre branco. A correção do fallback índigo
`#6467F2` (o resquício shadcn) é o item de maior retorno da tabela inteira: é
exatamente o roxo de template que os três concorrentes acima estão usando.

---

## Clínica — `#376BBE` / 0.55rem → **manter**

**Concorrentes (paleta extraída do CSS).**

| Produto | Acento principal | Neutro | Raio declarado | Tipografia |
|---|---|---|---|---|
| [iClinic](https://iclinic.com.br/) | `#2272cc` (azul), apoio `#4aa4f2` | `#1a1a1a` | `0.6rem` dominante | Inter 300–700 |
| [Doctoralia](https://www.doctoralia.com.br/) | teal `#006a59` / `#007c68` | bege `#f5f2ef`, `#2a2623` | 8px (`m`), 16px (`l`), botão pill | system-ui |
| [Clínica nas Nuvens](https://www.clinicanasnuvens.com.br/) | navy `#1d3c55` + turquesa `#34cdd7` | — | 5px / 1rem | Poppins |
| [Simples Dental](https://www.simplesdental.com/) | amarelo `#ffc200` + azul `#2196f3` | `#252626` | `.25rem` + tokens | Inter |
| [Amplimed](https://amplimed.com.br/) | roxo profundo `#25094c` + violeta `#9900f5` | — | 12px | "Versos" (custom) |
| [Ninsaúde](https://www.ninsaude.com/) | quase-preto `#121212` | `#f2f2f2` | 20px | Sora |

**Convenção de cor.** Azul é a **pluralidade, não a unanimidade**: 3 de 6 usam azul
como acento primário, 1 migrou para teal, 1 é roxo, 1 é preto. Isso importa para a
decisão: a convenção "clínica = azul" é **média**, não forte. Romper custaria pouco —
mas também não há motivo para romper, já que o azul não é o problema (o problema era
saturação, e `#376BBE` já resolve).

**Credibilidade.** Aqui há peso regulatório real: dado de saúde é **dado pessoal
sensível** pela LGPD, art. 5º, II
([Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)),
e prontuário tem prazo mínimo de guarda de 20 anos (Lei 13.787/2018). Isso sustenta a
direção "menos saturado, canto mais reto" da revisão — e o mercado concorda na forma:
iClinic `0.6rem`, Doctoralia 8px. O alvo de `0.55rem` está dentro da norma do setor.

**Veredito: manter `#376BBE` / 0.55rem.** Contraste 5,24:1 com branco (AA ok),
4,75:1 como `text-brand` sobre `bg-brand-soft`. Nenhuma evidência recomenda mudança.

---

## Psicologia — `#6741AA` / 0.55rem → **manter, com ressalva registrada**

**Concorrentes.** O nicho se divide em duas famílias visuais, e elas discordam:

*Software de gestão para o psicólogo (o público real da Eliza):*

| Produto | Acento | Superfície | Tipografia |
|---|---|---|---|
| [PsiNota AI](https://psinotaai.com/) | teal `#0d7377` | navy `#0d1b2a`, creme `#f1ebdf` | Fraunces (serifada) |
| [Corpora](https://usecorpora.com.br/) | ocre `#e9c46a` | creme `#f4f1eb` | Lora (serifada) + Public Sans |
| [Cuidaty](https://cuidaty.com/) | azul-ardósia `#356588` + menta `#5ac3b0` | `#0c202f` | — |
| [PsicoManager](https://www.psicomanager.com.br/) | navy `#0c447c` + ciano `#00c4d1` | creme `#f7f5f0` | — |

*Marketplace de terapia para o paciente final:*

| Produto | Acento |
|---|---|
| [Zenklub](https://zenklub.com.br/) | roxo `#7f56d9`, `#6941c6`, `#291454` |
| [Vittude](https://www.vittude.com/) | laranja `#ff7708` + navy `#1a4489` |
| [Sinappsy](https://sinappsy.com.br/) | azul `#2998ff` + índigo `#5643fa` |

**Convenção de cor — este é o achado desconfortável.** Roxo é a convenção do lado
**B2C** (Zenklub). Do lado B2B — o dono do consultório, que é o cliente da Eliza — a
convenção é **teal/navy sobre creme quente, frequentemente com serifada**. Nenhum dos
quatro produtos de gestão usa roxo.

Dois agravantes:
- `#7F56D9`, o roxo do Zenklub, é o **primary padrão do Untitled UI**
  ([untitledui.com](https://www.untitledui.com/react/components/color-pickers);
  [colorsandfonts](https://www.colorsandfonts.com/color-systems/untitledui-color-system/)).
  Ou seja, o roxo do nicho é literalmente o roxo de kit de UI — a mesma categoria de
  problema do índigo `#6467F2` que a refatoração está removendo.
- Roxo também não separa psicologia de clínica na cabeça do comprador: **Amplimed**,
  que é software de clínica, é roxo `#25094c`/`#9900f5`.

**Por que ainda assim: manter.** (a) O alvo `#6741AA` está a 44,7% de saturação e 46%
de luminosidade, contra ~63%/59% do `#7F56D9` — já é substancialmente mais escuro e
mais surdo que o roxo de template; a leitura "Untitled UI" não se sustenta no valor
proposto, só na família. (b) A alternativa que a evidência apontaria — teal —
**já está ocupada por tatuador (`#1C5F58`)** dentro da própria Eliza; migrar
psicologia para teal cria colisão interna pior que o problema que resolve.

**Credibilidade.** Peso regulatório é real: a Resolução CFP nº 001/2009 obriga registro
documental, guarda mínima de 5 anos e local que garanta sigilo e privacidade
([CFP](https://site.cfp.org.br/wp-content/uploads/2009/04/resolucao2009_01.pdf)) — e o
dado é sensível pela LGPD. Sustenta saturação baixa e canto contido.

**Ressalva a registrar (não é ação desta refatoração).** O diferencial de credibilidade
que o setor de fato usa **não é o matiz — é a superfície e a tipografia**: creme quente
em vez de branco puro (PsiNota `#f1ebdf`, Corpora `#f4f1eb`, PsicoManager `#f7f5f0`) e
display serifada. A Eliza já tem esse creme especificado em
`marketing/src/base.css` (`--paper: #F6F4EF`), mas o produto roda em branco puro. Se
sobrar apetite depois da refatoração, o ganho de percepção neste nicho está aí, não no
hex do acento. Isso exigiria emenda ao contrato (D6/§5.7) — **não fazer agora**.

**Veredito: manter `#6741AA` / 0.55rem.** 7,21:1 com branco.

---

## Barbearia — `#B67135` / 0.3rem → **manter** (linha mais bem sustentada da tabela)

**Concorrentes.**

| Produto | Acento | Neutro | Raio declarado |
|---|---|---|---|
| [Trinks](https://www.trinks.com/) | laranja `#e55807` (apoio `#ff9254`, `#b44505`) | `#0e0e0e`, `#212529` | **`.25rem`** dominante, `.2rem`/`.3rem` |
| [Booksy](https://booksy.com/pt-br/) | amarelo `#fedc36` + `#853409` | preto | 4–8px |
| [Avec](https://avec.com.br/) | coral `#fc6440` | `#2b2b2b` | **`3px`** dominante (2–5px) |
| [AppBarber](https://www.appbarber.com.br/) | navy `#00233d` + azul `#0072bc` | Bootstrap | Bootstrap default |

**Convenção de cor.** Laranja/âmbar sobre preto é a convenção **forte** do lado
barbearia/beleza (Trinks e Avec são os dois maiores do Brasil; Booksy é a referência
internacional). AppBarber é a exceção azul, e roda Bootstrap sem identidade própria.
Romper para outro matiz custaria caro. `#B67135` é o "laranja mais quieto" — mesmo
território de reconhecimento, saturação compatível com a marca-mãe.

**Convenção de forma — evidência direta para o raio.** Trinks roda `0.25rem` e Avec
`3px`. O alvo de `0.3rem` da tabela é **mais folgado que o líder de mercado**, não mais
apertado. O argumento de que "canto reto pode parecer duro demais para barbearia" não
se sustenta: o mercado já é reto.

**Credibilidade.** Nicho expressivo, sem peso regulatório de dado sensível. Aqui a
sobriedade é escolha de marca (consistência entre nichos, conforme o escopo do
`MARKETING.md`), não exigência externa — e isso está ok.

**Veredito: manter `#B67135` / 0.3rem.** Duas notas de contraste, ambas já tratadas ou
tratáveis:
- 3,89:1 com branco → **reprova AA para texto**. O contrato já resolve com
  `--brand-primary-foreground` escuro (`240 6% 10%`, 4,56:1). Correto, manter.
- `text-brand` sobre `bg-brand-soft` = **3,57:1**. Passa o mínimo de 3:1 para
  componentes não-textuais (WCAG 1.4.11) e **reprova** para texto. Isso restringe o
  §4.3 do contrato: aqueles chips de KPI só podem levar **ícone** em `text-brand`; se
  algum levar numeral ou rótulo nessa cor, barbearia reprova. Vale conferir na execução.

---

## Salão — `#BC4E85` / 0.65rem → **ajustar para `#A8446F` / 0.5rem**

**Concorrentes.**

| Produto | Acento principal | Rosa aparece? | Raio declarado |
|---|---|---|---|
| [Trinks](https://www.trinks.com/) | laranja `#e55807` | não | `.25rem` |
| [Avec](https://avec.com.br/) | coral `#fc6440` + azul `#618ec6` | não | `3px` |
| [Gendo](https://www.gendo.com.br/) | terracota `#d4553f` + violeta `#7e45f1` | sim, secundário `#db2777` | tokens |
| [Belle](https://belle.app.br/) | índigo `#575ecf` sobre creme `#fcfbf8` | sim, secundário `#f858bc` | 2px / tokens |
| [Booksy](https://booksy.com/pt-br/) | amarelo `#fedc36` | não | 4–8px |
| [AppBeleza](https://appbeleza.com.br/) | `#428bca` + `#48cfad` (Bootstrap 2 legado) | não | — |

**Convenção de cor.** A convenção B2B de salão no Brasil é **coral/laranja/terracota**,
não rosa. Rosa aparece em dois produtos, sempre como **acento secundário**, nunca como
cor de marca. Ou seja: a convenção rosa é **fraca** — não é o que a dona do salão já vê
no software que usa. Isso corta os dois lados: rosa não é "errado", mas também não
compra reconhecimento. É espaço livre.

**Por que ainda assim não migrar para coral.** Restrição interna: barbearia já é
`#B67135` (bronze/laranja). Mover salão para coral colaria os dois nichos que o
Keckleon mais precisa distinguir. Manter o matiz rosa é a decisão certa **por razão
interna**, não por convenção de mercado — vale registrar isso, porque a justificativa
"rosa/glamour" da tabela não tem lastro externo.

**O que muda, e por quê (dois motivos independentes):**

1. **Contraste.** `#BC4E85` dá **4,60:1** com branco. O piso AA é 4,5:1 — a margem é de
   0,10. Qualquer clareamento futuro reprova, e `text-brand` sobre `bg-brand-soft` já dá
   **4,12:1** (reprova para texto). A proposta `#A8446F` dá **5,64:1** com branco e
   **5,05:1** sobre o soft — sai da borda em ambos, mantendo `0 0% 100%` como foreground.
   HSL: `334.2 42.4% 46.3%` (a tabela tem `330 45.1% 52.2%`).
2. **Raio.** `0.65rem` é o valor mais folgado de todo o sistema, e é exatamente o nicho
   cujo mercado roda mais apertado (Avec `3px`, Trinks `.25rem`). A justificativa
   "cantos macios/glamour" da tabela é contrariada pela evidência. Proposta: **`0.5rem`**
   — continua sendo o mais arredondado da Eliza (acima de advocacia `0.4` e barbearia
   `0.3`), preservando a ordem relativa que o `MARKETING.md` quer, sem ser o outlier.

**Credibilidade.** Sem peso regulatório. O risco aqui é o oposto do da clínica: rosa
saturado + canto largo é o que lê como "app de consumo" — que é literalmente o
diagnóstico da seção "Revisão prioritária". `#A8446F` a 42% de saturação com `0.5rem`
resolve isso melhor que o par atual.

**Veredito: ajustar → `#A8446F` / `0.5rem`.**

---

## Advocacia — `#374A62` / 0.4rem → **revisar para `#2C4A73`**

**Concorrentes.**

| Produto | Acento | Apoio | Raio declarado |
|---|---|---|---|
| [Aurum / Astrea](https://www.aurum.com.br/) | azul `#008fd5` | verde `#0db14b`, roxo `#503cab` | **8px** dominante, 4px, 16px |
| [ADVBOX](https://advbox.com.br/) | azul `#007dff` / `#005dff` | navy `#000d25`, `#00256a` | 10–16px |
| [Projuris ADV](https://www.projuris.com.br/adv/) | azul `#0756e4` | verde `#00b600`, navy `#0b1d39` | 8–12px |
| [EasyJur](https://www.easyjur.com/) | vermelho `#e5293f` | dourado `#f8e3b7` | 8–12px |

**Convenção de cor.** Azul **saturado** é a convenção forte (3 de 4). Ardósia
dessaturado não é o que o advogado vê hoje. Mas aqui a convenção **não deve vencer**, e
há fundamento externo para isso: o Provimento 205/2021 do CFOAB submete a publicidade
da advocacia aos princípios de **sobriedade e discrição**, vedando sensacionalismo e
mercantilização
([texto na OAB](https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021);
[PDF OAB/SP](https://www.oabsp.org.br/upload/526840268.pdf)). Um sistema que o
escritório usa e mostra para cliente ganha, e não perde, ao ser mais surdo que o
mercado. **A direção dessaturada da tabela está certa.**

**O que está errado então — dois problemas concretos:**

1. **Colisão com token de status.** `.theme-advocacia --brand-primary: 213.5 28.1% 30%`
   é **exatamente** o valor de `--status-info: 213.5 28.1% 30%`
   (`docs/CONTRATO_REFATORACAO_VISUAL.md`, linha 269 vs. 360). Ambos renderizam
   `#374A62`. Numa organização de advocacia, o acento da marca e o "informativo" ficam
   indistinguíveis — o que a decisão D4 proíbe em texto ("a cor do nicho nunca significa
   status"). Não é teoria: os badges informativos da varredura da Fase 4 vão sair na cor
   da marca.
2. **Distinção fraca entre nichos.** A 28,1% de saturação e 30% de luminosidade,
   `#374A62` lê mais como cinza-azulado neutro do que como cor de marca — perto de
   `generico` (`#18181B`) a diferença é sutil. O critério de aceite da Fase 2 ("cada um
   dos 8 nichos renderiza uma cor distinta") é mais frágil nesta linha do que em
   qualquer outra.

**Proposta: `#2C4A73`** — HSL `214.6 44.7% 31.2%`. Mantém o matiz azul (dentro da
convenção do setor) e a luminosidade sóbria (dentro do Provimento 205), mas sobe a
saturação de 28% para 45%, o que (a) descola de `--status-info`, (b) torna a cor
legível como marca e não como cinza. Contraste **9,00:1** com branco, **8,15:1** sobre
o soft — o mais folgado dos oito depois do genérico.

**Raio: manter `0.4rem`.** Aurum roda 8px (`0.5rem`); `0.4rem` é defensavelmente mais
contido e coerente com a exigência de sobriedade.

> Alternativa equivalente, se preferirem não mexer na cor de nicho: mover
> `--status-info` para outro valor. Mesmo custo de edição, mas o blast radius é maior
> (afeta os 8 temas), e a evidência acima recomenda subir a saturação de advocacia de
> qualquer forma. **Recomendação: mexer na cor do nicho.**

---

## Certificado digital — `#2B6443` / 0.4rem → **revisar para `#35603F`**

**Concorrentes / referência.** O usuário deste nicho é a **AR (Autoridade de Registro)**
— o pequeno negócio que agenda e faz a validação presencial ou por videoconferência
([fluxo descrito pela Certisign](https://certisign.com.br/suporte/agendamento/videoconferencia)).
A referência visual dele é a AC de quem ele é parceiro:

| Autoridade Certificadora | Acento principal | Raio declarado |
|---|---|---|
| [Certisign](https://www.certisign.com.br/) | **violeta `#593eff`** + lilás `#e8a6ff` | 8px |
| [Soluti](https://www.soluti.com.br/) | **verde-petróleo `#19665b`** + verde `#19d16a` | 10px |
| [Serasa Certificado Digital](https://serasa.certificadodigital.com.br/) | **roxo Experian `#632678`** + azul `#406eb3` | 16–20px |
| [Valid](https://www.validcertificadora.com.br/) | **vermelho `#dc4943`** | tokens |
| [gov.br](https://www.gov.br/pt-br) (referência ICP-Brasil) | azul `#1351B4`; verde `#168821` é o **positivo/sucesso**, não a marca | — |

**Convenção de cor: não existe.** Quatro ACs, quatro famílias diferentes (violeta,
verde, roxo, vermelho). Verde aparece em uma. A premissa "verde institucional" da tabela
**não tem lastro no mercado** — ela vem da associação genérica cadeado/válido, não do que
o público vê.

E essa associação é justamente o problema. Em gov.br, verde é a cor do **estado
positivo**, com o azul como institucional. Num produto de certificado digital, verde não
lê como marca; lê como "certificado válido".

**Problema concreto (o mesmo de advocacia, e aqui é pior).**
`.theme-certificado --brand-primary: 145.3 39.9% 28%` é **exatamente**
`--status-success: 145.3 39.9% 28%` (linhas 270 e 357 do contrato). Ambos renderizam
`#2B6443`. Neste nicho específico, "cor da marca = cor de sucesso" não é só uma
violação formal da D4 — é ambiguidade semântica real na tela que mais importa
(emissão concluída / pendente).

**Proposta mínima: `#35603F`** — HSL `134.0 28.9% 29.2%`, contraste **7,25:1** com
branco e **6,73:1** sobre o soft. Continua verde (preserva o precedente Soluti e a
associação institucional), mas desloca matiz (134 vs. 145) e saturação (29% vs. 40%) o
suficiente para não ser o token de sucesso. É a mudança de menor risco.

> **Alternativa mais forte, com uma condição.** `#1F5A6B` (petróleo, HSL
> `193.4 55.1% 27.1%`, **7,68:1**) resolveria melhor: sai inteiramente do território
> "verde = válido" e fica na família azul institucional do gov.br/ICP-Brasil.
> **Só que colide com tatuador `#1C5F58`** (193 vs. 174, ambos escuros). Só vale se
> tatuador também mudar — e, como a seção seguinte mostra, não há evidência para mexer
> em tatuador. **Recomendação: ficar com `#35603F`.**

**Raio: manter `0.4rem`.** Certisign roda 8px; `0.4rem` é coerente com o registro
institucional. Sem contra-evidência.

---

## Tatuador — `#1C5F58` / 0.45rem → **sem evidência suficiente; manter por default**

**Isto é um "não achei", não uma validação.**

**Concorrentes encontrados.**

| Produto | Acento | Observação |
|---|---|---|
| [TattFlow](https://www.tattflow.com.br/) | violeta `#8b5cf6` / `#7c3aed` sobre fundo escuro `#120c24`, `#0f0d1a` | `#8b5cf6` é o **violet-500 padrão do Tailwind** |
| [GestãoInk](https://gestaoink.site/) | `#0d6efd`, `#198754`, `#dc3545` | paleta **default do Bootstrap**, sem identidade |
| [Opero](https://operosistemas.com.br/sistema-para-estudio-de-tatuagem) | `#2563eb` | **blue-600 padrão do Tailwind** |
| [Booksy](https://booksy.com/pt-br/) (atende tatuagem) | amarelo `#fedc36` + preto | identidade de beleza, não de tatuagem |

**Convenção de cor: não há.** Os três sistemas brasileiros de estúdio de tatuagem que
consegui abrir usam **cor default de framework** — nenhum tem paleta desenhada. Não
existe convenção a honrar nem a romper. Qualquer afirmação sobre "a cor que o tatuador
associa à categoria" seria invenção minha; não vou fazer.

**O único sinal recorrente e real é a superfície escura**, não o matiz: o TattFlow roda
fundo `#120c24`/`#0f0d1a`, coerente com a cultura de estúdio (preto, alto contraste).
A Eliza **não pode honrar isso** sem emendar a decisão D6 (tema claro é o padrão), e
essa emenda está fora do escopo da refatoração. Fica registrado como observação, não
como recomendação.

**Credibilidade.** Menos expressivo do que a tabela assume. O que os próprios
fornecedores anunciam como diferencial são documentos: ficha de anamnese, termo de
consentimento assinado, tracking de cicatrização
([Graces](https://graces.com.br/estudio-de-tatuagem/) — texto comercial do fornecedor,
não norma). O caminho sóbrio não é um erro de leitura do nicho.

**Veredito: manter `#1C5F58` / 0.45rem** — por ausência de contra-evidência, não por
validação. Contraste 7,43:1 com branco, 6,98:1 sobre o soft. É o único teal do sistema,
o que ajuda na distinção interna entre os 8 nichos. **Condição**: se certificado migrar
para `#1F5A6B` (a alternativa recusada acima), esta linha precisa ser reaberta.

---

## Anexos

### A. Contraste de todas as cores-alvo (WCAG 2.1)

Verificação de que os HSL do contrato batem com os hex do `MARKETING.md`: **os 8 batem**.

| Nicho | Hex | vs. branco | vs. `#18181B` | `text-brand` / `bg-brand-soft` |
|---|---|---|---|---|
| Genérico | `#18181B` | 17,72 | — | 16,12 |
| Clínica | `#376BBE` | 5,24 | 3,38 | 4,75 |
| Psicologia | `#6741AA` | 7,21 | 2,46 | 6,41 |
| Barbearia | `#B67135` | **3,89** ⚠ | **4,56** ✔ | **3,57** ⚠ |
| Salão | `#BC4E85` | **4,60** ⚠ margem 0,10 | 3,85 | **4,12** ⚠ |
| Advocacia | `#374A62` | 9,06 | 1,96 | 8,23 |
| Certificado | `#2B6443` | 6,98 | 2,54 | 6,52 |
| Tatuador | `#1C5F58` | 7,43 | 2,39 | 6,98 |

Propostas: `#A8446F` (salão) 5,64 / 5,05 · `#2C4A73` (advocacia) 9,00 / 8,15 ·
`#35603F` (certificado) 7,25 / 6,73. Todas com `--brand-primary-foreground: 0 0% 100%`.

⚠ **Barbearia e salão só passam no par `brand`/`brand-soft` sob o critério de 3:1 para
componentes não-textuais (WCAG 1.4.11).** O §4.3 do contrato só é conforme se aqueles
chips levarem apenas ícone. Texto em `text-brand` sobre `bg-brand-soft` reprova nos dois.

### B. Convenção de raio observada no mercado

| Produto | Raio dominante | Nicho |
|---|---|---|
| Avec | 3px (~0,19rem) | salão |
| Trinks | 0,25rem | barbearia/salão |
| Doctoralia | 8px (0,5rem) | clínica |
| Aurum/Astrea | 8px (0,5rem) | advocacia |
| Certisign | 8px (0,5rem) | certificado |
| Soluti | 10px | certificado |
| iClinic | 0,6rem | clínica |

Faixa-alvo da Eliza (0,3–0,65rem) está **dentro** desta distribuição, com salão como
único valor acima de tudo que o mercado pratica. Confirma o veredito da seção Salão.

### C. Tipografia observada

Inter (iClinic, Simples Dental) · Poppins (Clínica nas Nuvens, Sinappsy) · system-ui
(Doctoralia) · Sora (Ninsaúde) · ProximaNova (Booksy) · Versos (Amplimed) ·
**serifadas de display em psicologia**: Lora (Corpora), Fraunces (PsiNota).

**IBM Plex Sans: zero ocorrências em 20 sites amostrados.** A decisão já tomada é
diferenciação genuína, não só coerência com o Pandora. O único padrão tipográfico de
credibilidade identificável no setor é a serifada em psicologia — não replicável aqui
sem quebrar a restrição de fonte única, e não recomendado.

### D. Limitações

- Amostra: sites **institucionais/marketing** dos concorrentes. Salvo onde indicado, não
  entrei no produto logado — a paleta interna pode divergir da vitrine.
- Não abriram: Feegow, AppBeleza (domínio `.com`), Avec (`.beauty`), Salão VIP,
  Simples Beleza, Safeweb, Beauty Date. Não afetam nenhum veredito.
- Preferências de gosto foram evitadas; toda proposta de cor está ancorada ou em número
  de contraste, ou em colisão de token verificável no contrato, ou em paleta extraída de
  CSS com URL. As duas afirmações não ancoradas em fonte externa estão marcadas no texto
  como restrição interna (salão vs. barbearia) e como observação (superfície escura em
  tatuador).
