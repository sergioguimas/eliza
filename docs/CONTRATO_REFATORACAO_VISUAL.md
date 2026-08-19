# Contrato — Refatoração Visual (alinhamento à marca SolaSoftware)

> **Para o agente executor.** Este documento é a especificação completa da tarefa.
> Leia inteiro antes de editar qualquer arquivo. Todas as decisões de design já
> foram tomadas e estão aqui — **você não precisa escolher nada**. Se encontrar
> uma situação que este contrato não cobre, pare e escale (ver §9).

- **Branch de trabalho**: `development`. Não fazer merge em `main`.
- **Revisão**: um humano confere fase a fase antes do merge.
- **Escopo**: apenas camada visual. Nenhuma mudança de lógica de negócio, query,
  RLS, migration ou rota.

---

## 1. Contexto

A Eliza foi construída em dez/2025, **antes de a SolaSoftware existir como marca**.
Por isso ela carrega a estética padrão do template shadcn (Inter, índigo `#6467F2`,
cantos de 12px) enquanto todo o resto da casa — e as próprias peças de marketing
da Eliza — já roda na identidade definida depois.

Existem hoje **duas Elizas visuais**:

| | Tipografia | Fundo | Acento | Raio |
|---|---|---|---|---|
| `marketing/` (peças já produzidas) | IBM Plex Sans | `#F6F4EF` papel | cores dessaturadas por nicho | 3–6px |
| `web/` (o produto) | Inter | `#FFFFFF` puro | índigo `#6467F2` | 12px |

O prospect recebe o folder na primeira identidade e entra no produto na segunda.
**A tarefa é eliminar essa diferença**, trazendo o produto para a identidade já
especificada em:

- `MARKETING.md` (raiz deste repo) — tabela de cores-alvo e raios-alvo por nicho
- `../SolaSoftware/brand/BRANDING.md` — regras da marca-mãe
- `marketing/src/base.css` — implementação de referência dessa identidade

**Isto não é um redesign.** Não há exploração visual a fazer. É aplicação de uma
decisão já documentada.

---

## 2. Regras invioláveis

1. **Não inventar valor de cor, raio, fonte ou espaçamento.** Todo valor que você
   escrever está tabelado neste documento. Se precisar de um que não está, escale.
2. **Não alterar lógica.** Nenhuma mudança em query Supabase, server action,
   validação, RLS, migration, rota ou contrato de dados. Se um ajuste visual
   parecer exigir mudança de lógica, escale.
3. **Não mexer em `components/ui/*`.** São primitivos shadcn corretos e já
   orientados a token — eles herdam a mudança de graça, e é justamente por isso
   que esta tarefa sai barata. **Não há exceção.** Se parecer necessário editar um
   primitivo, o problema está em outro lugar: escale.
4. **Não tocar em `app/marcar/[slug]/public-booking-form.tsx`** além das duas
   correções pontuais da Fase 1. Ver §8.
5. **Não criar landing page, nem página nova, nem componente novo** que não esteja
   pedido aqui.
6. **Não rodar `npm run build` para validar.** Segundo `docs/DEPLOY.md`, o build
   pode servir cache velho. Validar com `npm run dev` e `npx tsc --noEmit`.
7. **Um commit por fase.** Mensagem no padrão do repo (`refactor(visual): ...`).
   Não amontoar fases num commit só — o revisor confere fase a fase.
8. **Se um arquivo divergir do que este contrato descreve** (linha diferente,
   trecho ausente), não adaptar por conta própria: escale.

---

## 3. Fora de escopo — não fazer

Estes itens foram avaliados e **deliberadamente excluídos** desta tarefa. Não os
execute nem "de brinde".

| Item | Por que ficou de fora |
|---|---|
| **Varredura das 463 cores fixas** nos 7 arquivos que as concentram | Exige ler o contexto de cada ocorrência para decidir se é status ou decoração → contrato de revisão, item R2 |
| **Tratamento dos chips de KPI do dashboard** | Decisão de design, não de token → R2 |
| **Revisar a tabela de cores/raios por nicho** | Já foi feito: a pesquisa (`docs/PESQUISA_NICHOS_VISUAL.md`) foi incorporada e a tabela de 2.1 é final. Aplique como está; não reabra |
| Reestruturar `/marcar/[slug]` (1.238 linhas: H1 duplicado, bloco de documentos duplicado, stepper que corta rótulo no mobile) | Caminho de receita, exige julgamento de produto e deve ser informado por uso real dos primeiros betas |
| Mudar layout/IA do dashboard (chrome do topo, chips "ORGANIZAÇÃO"/"CARGO", nome da org repetido 3×) | Decisão de informação, não de identidade |
| Corrigir truncamento dos rótulos da tab bar mobile | Mesmo motivo |
| Desenhar símbolo, ícone ou monograma para a Eliza | O wordmark já existe e é a marca — ver §7. Portar, não criar |
| Criar `app/page.tsx` (landing) | Projeto separado |
| Qualquer mudança em `supabase/` | Fora do escopo visual |

---

## 4. Decisões já tomadas

Registradas aqui para que você não precise decidir nada.

**D1 — Fonte única de verdade da identidade por nicho: `web/app/globals.css`.**
Hoje existem **quatro** fontes concorrentes e divergentes para a cor de nicho:

1. `globals.css` → blocos `.theme-*` (HSL) — nunca aplicados
2. `lib/niche-config.ts` → objeto `brand` (hex) — alimenta `brandVars`, que nunca é aplicado
3. `lib/niche-config.ts` → `setupStylesByNiche` (classes Tailwind fixas) — o único que renderiza
4. `MARKETING.md` → a tabela-alvo

Elas discordam entre si. Exemplo: `advocacia` é ardósia em (1) e (2), mas **rosa**
em (3). E `generico` é quase-preto em (1) e (4), mas índigo `#6366f1` em (2).

**Decisão: (1) vence. (2) e (3) são deletados.** `niche-config.ts` passa a conter
só metadado não-visual (id, label, description, icon, appTitle, sidebarLabel).

**D2 — O `:root` passa a valer os valores do tema `generico`.**
Assim a identidade institucional fica correta em todas as 8 rotas públicas
(`/login`, `/setup`, `/convite`, `/forgot-password`, `/reset-password`,
`/update-password`, `/suspended`, `/demo/start`) sem tocar em nenhuma delas.
A classe `.theme-*` só é aplicada onde existe organização: `(app)/layout.tsx` e
`marcar/[slug]/page.tsx`.

**D3 — Raio: vale a tabela do `MARKETING.md` (0,3–0,65rem), não os 2–4px do
`BRANDING.md` §8.** O `BRANDING.md` governa peças institucionais; o `MARKETING.md`
é a especificação do produto e já foi derivada da marca-mãe.

**D4 — Cores de status são separadas do acento de marca.** Sucesso/atenção/erro
não usam a cor do nicho, e a cor do nicho nunca significa status. Quatro tokens
novos, definidos em §5.4.

**D5 — O vermelho lacre (`#7D2430`) não entra na UI de uso diário.**
`BRANDING.md` §9.5 reserva ele para o selo de rodapé e a tela de login. Não usar
como acento, nem como cor de erro.

**D6 — Tema claro é o padrão.** Ver §5.7.

---

## 5. Execução

### Ordem de execução

**Fase 1 → 2 → 3 → 4 → 5 → 6 → 7**, na ordem.

O item 2.1 esteve bloqueado aguardando pesquisa de mercado. **O bloqueio foi
levantado** e a tabela é final — não há mais nada em espera neste contrato.

### Fase 1 — Correções (não altera a linguagem visual)

Objetivo: fazer o sistema atual funcionar antes de trocar seus valores. **Ao final
desta fase o produto deve estar visualmente igual, exceto pelos três bugs corrigidos.**

**1.1 — `web/app/globals.css`: variável `--brand` inexistente.**
Três declarações usam `hsl(var(--brand))`, mas só existe `--brand-primary`. A
variável resolve vazio e as declarações caem. Linhas ~389, ~392, ~404, ~438
(blocos `.sidebar-item-active`, seu `::before` e o hover da scrollbar).

Substituir **todas** as ocorrências de `var(--brand)` por `var(--brand-primary)`.

```bash
grep -n "var(--brand))" web/app/globals.css   # deve retornar 0 linhas ao final
grep -n "var(--brand) /" web/app/globals.css  # idem
```

**1.2 — `web/app/globals.css`: `--brand-shadow-strength` só existe no escuro.**
Definida em `.dark` (linha ~129) mas não em `:root`. No tema claro,
`--brand-shadow-color` fica inválida e `.shadow-brand` não produz sombra.

No bloco `:root`, imediatamente **antes** da linha
`--brand-shadow-color: hsla(...)` (linha ~82), inserir:

```css
  --brand-shadow-strength: 0.14;
```

**1.3 — `web/app/(app)/layout.tsx`: aplicar a classe de tema e remover código morto.**

O objeto `brandVars` (linhas ~65–76) é montado e nunca usado. E a classe
`theme-${niche}` nunca é aplicada. O padrão correto já existe no repo, em
`web/app/admin/layout.tsx:12,15` — siga-o.

- **Deletar** integralmente o bloco `const brandVars = { ... } as React.CSSProperties`.
- **Deletar** a linha duplicada `const nicheMeta = getNicheMetadata(niche)` (~64) e
  trocar os dois usos de `nicheMeta` por `meta`.
- Na `<div>` raiz do return, trocar:

```tsx
<div className={`min-h-screen bg-background text-foreground`}>
```

por:

```tsx
<div className={`theme-${niche} min-h-screen bg-background text-foreground`}>
```

**1.4 — `web/app/marcar/[slug]/page.tsx`: aplicar a classe de tema.**
`organization.niche` já é buscado. Na `<div>` raiz, trocar:

```tsx
<div className="min-h-screen bg-background py-10 px-4">
```

por:

```tsx
<div className={`theme-${organization.niche ?? "generico"} min-h-screen bg-background py-10 px-4`}>
```

**1.5 — `web/app/(app)/dashboard/page.tsx:299`: diálogo escuro no tema claro.**

```tsx
<DialogContent className="max-w-md border-zinc-800 bg-zinc-950">
```
→
```tsx
<DialogContent className="max-w-md">
```

E na linha ~304, `<DialogDescription className="text-zinc-400">` →
`<DialogDescription>` (o primitivo já aplica `text-muted-foreground`).

**1.6 — `web/app/marcar/[slug]/public-booking-form.tsx:476 e 485`: contraste ~1,5:1
na página do paciente.** São valores de tema escuro num fundo claro.

Linha 476:
```tsx
!active && !done && "border-zinc-800 bg-background text-zinc-300"
```
→
```tsx
!active && !done && "border-border bg-background text-muted-foreground"
```

Linha 485:
```tsx
!active && !done && "border-zinc-500 text-zinc-300"
```
→
```tsx
!active && !done && "border-border text-muted-foreground"
```

> São as **únicas** duas edições permitidas neste arquivo nesta fase.

**Aceite da Fase 1**

- [ ] `grep -rn "var(--brand))" web/app/globals.css` → vazio
- [ ] `grep -rn "brandVars" web/` → vazio
- [ ] No dev, logado numa org de nicho `clinica`, o console retorna
      `getComputedStyle(document.documentElement).getPropertyValue('--brand-primary')`
      → `217 91% 60%` (**não** `239 84% 67%`)
- [ ] `document.querySelectorAll('[class*="theme-"]').length` > 0 no app e em `/marcar/[slug]`
- [ ] `npx tsc --noEmit` limpo

---

### Fase 2 — Valores da identidade

> **Tabela final.** O bloqueio que existia aqui foi levantado: a pesquisa de
> mercado (`docs/PESQUISA_NICHOS_VISUAL.md`) chegou, foi incorporada, e a tabela
> abaixo é a versão definitiva. Quatro valores mudaram em relação ao `MARKETING.md`
> — salão, advocacia, certificado e o raio do salão. Aplique como está.

**2.1 — `web/app/globals.css`: substituir os 8 blocos `.theme-*`.** ✅ **LIBERADA**

Cada bloco fica exatamente com esta forma (exemplo `clinica`):

```css
.theme-clinica {
  --brand-primary: 216.9 55.1% 48%;
  --brand-primary-foreground: 0 0% 100%;
  --brand-ring: 216.9 55.1% 48%;
  --brand-soft: 216.9 50% 96%;
  --brand-soft-foreground: 216.9 45% 26%;
  --brand-border: 216.9 35% 85%;
  --brand-glow: 216.9 55.1% 48%;
  --brand-radius: 0.55rem;
}
```

Tabela completa:

| bloco | `--brand-primary` | `--brand-primary-foreground` | `--brand-soft` | `--brand-soft-foreground` | `--brand-border` | `--brand-radius` |
|---|---|---|---|---|---|---|
| `.theme-generico` | `240 5.9% 10%` | `0 0% 100%` | `240 5% 96%` | `240 5.9% 12%` | `240 5.9% 85%` | `0.5rem` |
| `.theme-clinica` | `216.9 55.1% 48%` | `0 0% 100%` | `216.9 50% 96%` | `216.9 45% 26%` | `216.9 35% 85%` | `0.55rem` |
| `.theme-psicologia` | `261.7 44.7% 46.1%` | `0 0% 100%` | `261.7 44.7% 96%` | `261.7 44.7% 26%` | `261.7 35% 85%` | `0.55rem` |
| `.theme-barbearia` | `27.9 54.9% 46.1%` | `240 6% 10%` | `27.9 50% 96%` | `27.9 45% 26%` | `27.9 35% 85%` | `0.3rem` |
| `.theme-salao` | `334.2 42.4% 46.3%` | `0 0% 100%` | `334.2 42.4% 96%` | `334.2 42.4% 26%` | `334.2 35% 85%` | `0.5rem` |
| `.theme-advocacia` | `214.6 44.7% 31.2%` | `0 0% 100%` | `214.6 44.7% 96%` | `214.6 44.7% 26%` | `214.6 35% 85%` | `0.4rem` |
| `.theme-certificado` | `134 28.9% 29.2%` | `0 0% 100%` | `134 28.9% 96%` | `134 28.9% 26%` | `134 28.9% 85%` | `0.4rem` |
| `.theme-tatuador` | `173.7 54.5% 24.1%` | `0 0% 100%` | `173.7 50% 96%` | `173.7 45% 26%` | `173.7 35% 85%` | `0.45rem` |

Em todos, `--brand-ring` e `--brand-glow` recebem **o mesmo valor de
`--brand-primary`**.

> ⚠️ **`barbearia` é a única com `--brand-primary-foreground` escuro.** A cor-alvo
> `#B67135` dá contraste 3,9:1 com branco (reprova AA) e 4,6:1 com tinta escura.
> Não "uniformizar" para branco.

**O que mudou em relação ao `MARKETING.md`**, e por quê (detalhe em
`docs/PESQUISA_NICHOS_VISUAL.md`):

| Nicho | Era | Virou | Motivo |
|---|---|---|---|
| Salão | `#BC4E85` / 0.65rem | `#A8446F` / **0.5rem** | 4,60:1 era margem de 0,10 sobre o piso AA. E 0.65rem era o único raio da tabela acima de tudo que o mercado pratica (Trinks 0.25rem, Avec 3px) |
| Advocacia | `#374A62` | `#2C4A73` | Era idêntico ao antigo `--status-info`. A 28% de saturação lia como cinza, não como marca |
| Certificado | `#2B6443` | `#35603F` | Era idêntico ao antigo `--status-success`. Verde nesse setor já significa "certificado válido" |

Os outros cinco nichos foram validados contra concorrentes reais e **ficam como
estavam**.

**2.2 — `web/app/globals.css`: `:root` passa a valer `generico` (decisão D2).**
No bloco `:root`, na seção "Branding default" (linhas ~38–46), trocar os valores
índigo pelos de `.theme-generico` da tabela acima. Trocar também
`--brand-accent: 243 75% 59%` por `240 5.9% 10%`.

**2.3 — `web/app/globals.css`: `--radius` acompanha o nicho.**
Verificar que a linha ~63 é `--radius: var(--brand-radius);` e que
`--brand-radius` **não** é redeclarado depois do bloco de branding dentro de
`:root` (hoje aparece duas vezes, linhas ~46 e ~62 — manter só uma).

**Aceite de 2.2 e 2.3**

- [ ] `grep -n "239 84%\|243 75%\|#6467F2\|#6366f1" web/app/globals.css` → vazio
- [ ] `--brand-radius` aparece **uma vez só** dentro de `:root`
- [ ] `/login`, `/setup` e `/demo/start` não têm mais nenhum índigo — o acento
      institucional é quase-preto

**Aceite de 2.1**

- [ ] Numa org `barbearia`, o texto do botão primário é escuro, não branco
- [ ] Cada um dos 8 nichos renderiza uma cor distinta (checar via `/setup`)

---

### Fase 3 — Tipografia

**3.1 — `web/app/layout.tsx`: Inter → IBM Plex Sans.**

```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
```
→
```tsx
import { IBM_Plex_Sans } from "next/font/google";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex",
});
```

E no `<body>`, trocar `${inter.className}` por `${plex.className}`.

> `IBM_Plex_Sans` **não** é fonte variável no `next/font` — o array `weight` é
> obrigatório. Omiti-lo quebra o build.

**3.2 — Não trocar peso de nada.** A troca de família é a única mudança desta
fase. Ajuste de escala tipográfica **não** está no escopo.

**Aceite da Fase 3**

- [ ] `grep -rn "Inter" web/app/layout.tsx` → vazio
- [ ] No dev, `getComputedStyle(document.body).fontFamily` contém `IBM Plex Sans`
- [ ] Nenhum flash de fonte fallback visível ao recarregar

---

### Fase 4 — Fonte única de verdade

> **Escopo reduzido.** A varredura semântica das 463 cores fixas e o tratamento
> dos chips de KPI **saíram desta tarefa** e passaram para o contrato de revisão
> (`CONTRATO_REVISAO_OPUS.md`, item R2). Motivo: decidir se um `text-blue-500`
> é status ou decoração exige ler o contexto de cada ocorrência, e errar isso
> espalha ruído por 40 arquivos. Aqui ficou só o que é mecânico.
>
> Consequência esperada e aceita: ao final desta fase, `setup-form.tsx` e
> `demo-niche-picker.tsx` ficam **parcialmente migrados** — a cor de nicho vem da
> fonte única, mas ainda há utilitários de paleta fixa neles. Isso é normal e
> será fechado na revisão. Não tente completar por conta própria.

**4.1 — `web/app/globals.css`: criar os tokens semânticos de status.**

Eles são pré-requisito da varredura que vem depois. Criar agora, mesmo sem
consumidor imediato. Não são cor de nicho: status nunca usa a cor da marca, e a
cor da marca nunca significa status (decisão D4).

No bloco `:root`, ao final:

```css
  /* ---------- Status semântico (independe do nicho) ---------- */
  --status-success: 125 50% 35%;
  --status-warning: 45 50% 33%;
  --status-danger:  14.8 58.8% 44.7%;
  --status-info:    197 48% 41%;
```

No bloco `.dark`, ao final:

```css
  --status-success: 125 45% 58%;
  --status-warning: 45 45% 58%;
  --status-danger:  14.8 45% 58%;
  --status-info:    197 45% 58%;
```

No bloco `@theme inline`, junto dos outros `--color-*`:

```css
  --color-success: hsl(var(--status-success));
  --color-warning: hsl(var(--status-warning));
  --color-danger:  hsl(var(--status-danger));
  --color-info:    hsl(var(--status-info));
```

Isso habilita `text-success`, `bg-success/10`, `border-warning/20` etc.

Os valores têm contraste verificado nos dois temas **e** distância perceptual
verificada contra as 8 cores de nicho — nenhum status fica a menos de ΔE 19 da cor
de marca de qualquer nicho. `--status-danger` é o `utility-warning` do
`BRANDING.md`. Copiar literalmente: são valores calculados, não escolhidos.

**4.2 — `lib/niche-config.ts`: deletar `setupStylesByNiche` (decisão D1).**

É a única das quatro fontes de cor de nicho que renderiza hoje, e é a que discorda
das outras (`advocacia` é rosa aqui e ardósia em todas as demais).

- Deletar o objeto `setupStylesByNiche` (linhas ~23–63).
- Deletar os campos `color`, `soft`, `selected` do tipo `SetupNicheOption`
  (linhas ~18–20). O tipo fica com `id`, `label`, `description`, `icon`.
- `getSetupNicheOptions()` para de repassar esses três campos.
- Nos dois consumidores — `app/setup/setup-form.tsx:81` e
  `app/demo/start/demo-niche-picker.tsx:17` — o card de cada nicho passa a receber
  `className={`theme-${option.id}`}` e usar as utilidades **já existentes** em
  `globals.css`: `bg-brand-soft` e `border-brand`.

> ⚠️ **Não somar `text-brand` sobre `bg-brand-soft`.** A utilidade `.bg-brand-soft`
> já define o próprio `color` (`--brand-soft-foreground`), que passa AA nos 8
> nichos. `text-brand` por cima dá **3,57:1 em barbearia** e reprova. Use
> `text-brand` só sobre fundo neutro.

Assim cada card mostra a cor real do nicho, vinda da fonte única. Substituir
apenas as classes que vinham de `color`/`soft`/`selected` — **não** varrer o resto
do arquivo (isso é R2).

**4.3 — `lib/niche-config.ts`: deletar o objeto `brand` (decisão D1).**

Alimenta o `brandVars` que a Fase 1.3 já removeu. Sem consumidor.

- Remover o tipo `NicheBrandConfig` e o campo `brand` de `NicheMetadata`.
- Remover os 8 objetos `brand: { ... }`.
- Em `providers/keckleon-provider.tsx`, remover `brand: meta.brand` (linha ~48) e
  o campo `brand` do tipo `KeckleonContextType` (linha ~20), além do import de
  `NicheBrandConfig` (linha ~5).

Seguro: os 20 consumidores de `useKeckleon()` usam só `dict`. Confirme antes:

```bash
grep -rn "useKeckleon()" web/app web/components | grep -v "{ dict }"
```
→ deve retornar vazio. Se retornar algo, **pare e escale**.

**Aceite da Fase 4**

- [ ] `grep -rn "setupStylesByNiche\|NicheBrandConfig\|meta.brand\|\.brand" web/lib web/providers web/app` → vazio
- [ ] `npx tsc --noEmit` limpo
- [ ] `/setup` e `/demo/start` mostram 8 cores distintas nos cards, e a cor de
      `advocacia` é ardósia (não rosa)
- [ ] Os tokens `--status-*` existem em `:root` e em `.dark`, e
      `text-success` / `bg-warning/10` geram CSS válido no dev

### Fase 5 — Raio

Os 32 usos de `rounded-2xl` / `rounded-3xl` / `rounded-[24–28px]` ignoram a escala
de raio. Sem esta fase, a redução da Fase 2 não chega na tela.

| arquivo | ocorrências |
|---|---|
| `app/setup/setup-form.tsx` | 15 |
| `components/layout/app-sidebar.tsx` | 4 |
| `components/demo/timeline-simulation.tsx` | 2 |
| `app/demo/start/demo-niche-picker.tsx` | 2 |
| `components/services/create-service-dialog.tsx` | 1 |
| `components/records/service-record-list.tsx` | 1 |

Mapeamento: `rounded-2xl`, `rounded-3xl`, `rounded-[24px]`, `rounded-[26px]`,
`rounded-[28px]` → **`rounded-lg`** (que resolve para `var(--radius)`, ou seja o
raio do nicho).

**Não tocar** em `rounded-full` (48 usos — avatares, pills e badges são circulares
de propósito) nem em `rounded-none`.

`app/marcar/[slug]/public-booking-form.tsx` (7 ocorrências) fica **fora** — §3.

**Aceite da Fase 5**

- [ ] `grep -rn "rounded-2xl\|rounded-3xl\|rounded-\[2[0-9]px\]" web/app web/components --include=*.tsx` → só as 7 de `public-booking-form.tsx`

---

### Fase 6 — Ativos de marca e metadata

**6.1 — Remover os SVGs do starter do Next.**
Deletar `web/public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`.
Confirmar antes que nenhum é referenciado:
`grep -rn "next.svg\|vercel.svg\|globe.svg\|window.svg\|file.svg" web/app web/components`

**6.2 — `web/app/layout.tsx`: metadata institucional.**

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://eliza.solasoftware.com.br"),
  title: { default: "Eliza", template: "%s | Eliza" },
  description: "Sistema de agendamento e gestão para clínicas, consultórios e prestadores de serviço.",
};
```

> ⚠️ **Não usar `getAppUrl()` de `lib/app-url.ts` aqui.** Ela é `async` e depende de
> `headers()`, então não funciona no escopo de módulo de um `export const metadata`.
> Usar a env diretamente, como acima.

**6.3 — `web/app/marcar/[slug]/page.tsx`: metadata por organização.**

Hoje o paciente que recebe o link no WhatsApp vê "Eliza — Gestão Inteligente",
sem imagem e sem o nome da clínica. Adicionar, no mesmo arquivo:

```tsx
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient<Database>()
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("slug", slug)
    .single()

  if (!org) return { title: "Agendamento" }

  return {
    title: `Agendar — ${org.name}`,
    description: `Reserve seu horário em ${org.name}.`,
    openGraph: {
      title: `Agendar — ${org.name}`,
      description: `Reserve seu horário em ${org.name}.`,
      type: "website",
    },
  }
}
```

> Manter as **mesmas colunas explícitas** já usadas na página (`id, name, slug, niche`
> são as únicas com SELECT para o papel `anon` — ver comentário no arquivo). Aqui
> só `name` é necessário. Não usar `select('*')`.

**6.4 — Substituir o logo-estetoscópio (`app/login/page.tsx:23–26`).**
Hoje a marca da Eliza no produto é o ícone `Stethoscope` do lucide — um
estetoscópio, num produto que também atende barbearia e advocacia.

**O wordmark oficial já existe** e está em uso em todas as peças de marketing
(folder, carrosséis, stories, one-pagers). A definição canônica está em
`marketing/src/base.css:118–123`:

```css
.wordmark { font-weight: 600; font-size: 26px; letter-spacing: .34em; text-transform: uppercase; }
.wordmark .dot { color: var(--lacre); }
```

Ou seja: **`ELIZA.`** — IBM Plex Sans 600, caixa alta, `letter-spacing: 0.34em`,
com o ponto final no vermelho lacre. Não inventar nada: portar isto.

Criar `web/components/shared/eliza-wordmark.tsx`:

```tsx
export function ElizaWordmark({
  className,
  withDot = false,
}: {
  className?: string
  withDot?: boolean
}) {
  return (
    <span
      className={cn(
        "font-semibold uppercase tracking-[0.34em] text-foreground select-none",
        className
      )}
    >
      Eliza
      {withDot && <span className="text-[#7D2430] dark:text-[#C05360]">.</span>}
    </span>
  )
}
```

Regras de uso (derivadas do `BRANDING.md`, não abertas a interpretação):

| Onde | `withDot` | Motivo |
|---|---|---|
| `app/login/page.tsx` | `true` | §9.2 — login/splash é o único ponto de UI onde o lacre pode aparecer |
| `components/layout/app-sidebar.tsx` | `false` | §9.5 — o lacre nunca compete com o acento do nicho na UI de uso diário |

Tamanho mínimo: **12px**. Abaixo disso o tracking de 0.34em desmonta a palavra —
se precisar de algo menor, usar só o "E" (ver 6.6).

Remover o import de `Stethoscope` de `app/login/page.tsx`.

**6.5 — Selo da SolaSoftware no rodapé** (`BRANDING.md` §9.1, obrigatório "sem exceção").

Copiar `../SolaSoftware/brand/logo/empilhado/sola-software-icone-transparente.png`
e `...-tema-claro-transparente.png` para `web/public/brand/`.

Criar `web/components/layout/sola-seal.tsx`: ícone (16px, versão conforme o tema)
+ o texto "SolaSoftware" em `text-xs text-muted-foreground`, linkando para
`https://solasoftware.com.br`. Renderizar no rodapé do `app/login/page.tsx` e no
rodapé da sidebar em `components/layout/app-sidebar.tsx`.

**Não** colocar no `/marcar/[slug]` — aquela página é da clínica, não da Sola.

**6.6 — Favicon.** Derivado do wordmark, não desenhado do zero.

Deletar `web/app/favicon.ico` (é o padrão do Next.js) e criar
`web/app/icon.svg` — o App Router serve este arquivo como favicon automaticamente:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Eliza">
  <rect width="64" height="64" rx="4" fill="#18181B"/>
  <g fill="#F6F4EF">
    <rect x="16" y="16" width="6"  height="32"/>
    <rect x="16" y="16" width="20" height="6"/>
    <rect x="16" y="29" width="15" height="6"/>
    <rect x="16" y="42" width="20" height="6"/>
  </g>
  <circle cx="44" cy="45" r="4" fill="#7D2430"/>
</svg>
```

O "E" do wordmark em tinta institucional sobre papel, com o ponto lacre — mesma
lógica da assinatura completa, legível a 16px. `rx="4"` respeita o
`BRANDING.md` §8 (cantos quase retos).

> ⚠️ O "E" é **desenhado com retângulos, não com `<text>`**. Favicon SVG não
> carrega webfont: um `<text>` em IBM Plex Sans cairia num fallback genérico do
> sistema. A construção geométrica é determinística e coerente com o
> `BRANDING.md` §8 ("linhas finas, cantos retos"). Não substituir por `<text>`.

Não usar nenhum arquivo de `SolaSoftware/brand/logo/` como favicon da Eliza — a
marca da mãe entra só no selo de rodapé (6.5).

**Aceite da Fase 6**

- [ ] `ls web/public/*.svg` → vazio
- [ ] Em `/marcar/<slug>`, `document.title` contém o nome da organização
- [ ] `document.querySelectorAll('meta[property^="og:"]').length` > 0 em `/marcar/<slug>`
- [ ] `grep -rn "Stethoscope" web/app/login` → vazio
- [ ] `web/app/favicon.ico` não existe mais; `web/app/icon.svg` existe e a aba do
      navegador mostra o "E" sobre tinta escura (não mais o logo do Next)
- [ ] O wordmark aparece com o ponto lacre **só** no login; na sidebar, sem ponto
- [ ] Selo da Sola visível no login e na sidebar, nos dois temas

---

### Fase 7 — Tema claro como padrão

`providers/theme-provider.tsx` usa hoje `defaultTheme="system"` com `enableSystem`.
O efeito prático é que quem tem o SO no escuro recebe um ERP escuro — leitura de
"ferramenta de dev" para um público de dono de clínica, barbeiro e advogado.

```tsx
<NextThemesProvider
  attribute="class"
  defaultTheme="light"
  enableSystem={false}
  disableTransitionOnChange
>
```

O `ThemeToggle` continua funcionando: quem preferir escuro escolhe, e a escolha
persiste. Só o padrão muda.

**Aceite da Fase 7**

- [ ] Numa janela anônima, com o SO em tema escuro, o app abre claro
- [ ] O `ThemeToggle` ainda alterna e a escolha sobrevive ao reload

---

## 6. Aceite final (rodar tudo antes de entregar)

```bash
cd web
npx tsc --noEmit
npx eslint .
```

```bash
grep -rn "var(--brand))\|brandVars\|setupStylesByNiche\|NicheBrandConfig" web/
```
→ deve retornar vazio.

```bash
grep -roE "\b(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" web/app web/components --include=*.tsx | wc -l
```
→ era 463. **Não se espera que esse número caia muito** — a varredura é do contrato
de revisão (R2), não desta tarefa. Serve só de linha de base: se ele **subir**,
alguém introduziu cor fixa nova, o que este contrato proíbe. Anote o número final
no relatório de entrega (§6.1).

Com `npm run dev`, percorrer e conferir nos **dois temas**:
`/login` · `/setup` · `/demo/start` · `/dashboard` · `/agendamentos` · `/clientes` ·
`/clientes/[id]` · `/servicos` · `/configuracoes` · `/marcar/[slug]`

Em cada uma: nenhum bloco com fundo do tema errado, nenhum texto de baixo contraste,
nenhum resquício de índigo.

### 6.1 — Relatório de entrega (obrigatório)

O revisor entra sem contexto desta execução. Ao terminar, escreva
`docs/RELATORIO_FASE_SONNET.md` com, e apenas com:

1. **Uma linha por fase**: concluída / concluída com desvio / não concluída.
2. **Todo desvio do contrato**, com arquivo, o que o contrato dizia e o que você fez.
   Se um número de linha não bateu, registre — é sinal de que o contrato envelheceu.
3. **Tudo que você escalou** (§9) e como ficou.
4. **O número final** da contagem de cores fixas acima, e o número de arquivos.
5. **Qualquer coisa que você notou e não consertou** por estar fora de escopo.
   Esta lista é insumo do revisor — não a filtre por relevância aparente.

Não inclua resumo do que o contrato já diz. O relatório é sobre o que **divergiu**
dele.

---

## 7. Sobre a marca — nada a decidir aqui

A Eliza **não tem um símbolo desenhado**, e isso é intencional, não uma lacuna.
O `MARKETING.md` registra a posição (linha ~111):

> "O que fica constante entre marca institucional e todos os nichos: **tipografia
> e estrutura de layout**. É isso que garante que continua 'parecendo Eliza' por
> baixo de qualquer cor de nicho — a identidade não está na cor, está na forma
> como o produto se comporta e se lê."

Um símbolo colorido brigaria com o Keckleon, que troca a cor a cada organização.
Um wordmark monocromático herda `currentColor` e funciona nos 8 nichos sem
variante. Por isso a marca da Eliza **é** o wordmark de 6.4 — ele já circula nas
peças de marketing desde antes desta tarefa.

O que o executor **não** deve fazer:

- desenhar um símbolo, ícone ou monograma novo;
- alterar tracking, peso ou caixa do wordmark;
- usar qualquer arquivo de `SolaSoftware/brand/logo/` como marca da Eliza.

Se em algum momento a Eliza ganhar um símbolo, ele entra por decisão humana e
substitui 6.6 — não por iniciativa do executor.

---

## 8. Já mapeado, fora desta tarefa

Registrado para não se perder, e para que o executor **não** tente resolver:

1. `public-booking-form.tsx` tem **duas UIs de upload duplicadas** no mesmo arquivo:
   um dropzone bem construído (linha ~928, com overlay `opacity-0` e UI própria) e
   um `<Input type="file">` cru (linha ~1171) que é o que aparece no resumo lateral
   — é a origem do "Escolher arquivo / Nenhum arquivo escolhido" visível ao paciente.
2. Dois `<h1>` concorrentes na mesma página pública (`page.tsx` e o form).
3. No mobile, as pílulas do stepper cortam os próprios rótulos, e há ~600px de
   preâmbulo antes do primeiro campo.
4. O bloco de documentos domina a coluna direita antes de o paciente escolher o serviço.
5. Não há aviso de privacidade/LGPD numa tela que coleta documento pessoal e
   encaminhamento médico.
6. A tab bar mobile trunca rótulos ("Dashbo…", "Configu…").
7. O nome da organização aparece 3× na mesma tela do dashboard.
8. `MARKETING.md` afirma que a identidade por nicho está "já implementada em código"
   e que o índigo "não vazou pra produção" — **as duas afirmações são falsas** e o
   texto deve ser corrigido depois que esta tarefa fechar.

---

## 9. Quando escalar em vez de decidir

Pare e pergunte se:

- Um arquivo não corresponde ao que este contrato descreve.
- Um ajuste visual parece exigir mudança de query, action, tipo de dado ou rota.
- Você precisa de um valor de cor, raio ou fonte que não está tabelado aqui.
- Um mapeamento da tabela de §4.2 é ambíguo no contexto (a cor pode ser status
  **ou** decoração e você não consegue decidir pelo texto ao redor).
- `npx tsc --noEmit` acusa erro que só se resolve mudando lógica.
- Algo neste contrato parece errado. Ele foi escrito a partir de leitura do código
  e de verificação em produção, mas o código é a autoridade final.

**Não** contorne um bloqueio com solução criativa. Escalar é o comportamento correto.
