# Relatório de entrega — Refatoração Visual (execução Sonnet)

## 1. Status por fase

1. **Fase 1 — Correções**: concluída. (commit `64130da`, já aplicado)
2. **Fase 2 — Valores da identidade**: concluída com desvio. (commit `33b4e9b`, já aplicado)
3. **Fase 3 — Tipografia**: concluída. (commit `83e9480`, já aplicado)
4. **Fase 4 — Fonte única de verdade**: concluída com desvio.
5. **Fase 5 — Raio**: concluída.
6. **Fase 6 — Ativos de marca e metadata**: concluída com desvio.
7. **Fase 7 — Tema claro como padrão**: concluída.

As fases 4 a 7 estão implementadas e validadas, mas **não commitadas** — aguardando sua revisão e commit manual, como combinado. Mensagens sugeridas foram dadas ao final de cada fase na conversa.

---

## 2. Desvios do contrato

### 2.1 — Fase 2: `--radius` congelado em `:root` (bug estrutural, não um desvio de leitura)

O item 2.3 mandava manter uma única declaração de `--radius: var(--brand-radius);` dentro de `:root`, e verifiquei ao vivo (org demo `barbearia`) que isso **não funciona**: CSS custom properties não são reavaliadas por elemento — como `--radius` só é declarado em `:root`, os descendentes herdam o valor já congelado ali (generico, `0.5rem`), mesmo dentro de um wrapper `.theme-barbearia` cujo `--brand-radius` local é `0.3rem`. Confirmado medindo o `border-radius` computado de um `rounded-lg` real: 8px (generico) em vez de 4.8px (barbearia).

Isso quebraria a premissa da própria Fase 5 (que o `rounded-2xl`→`rounded-lg` bastaria para o raio por nicho chegar na tela).

**Escalei, você aprovou.** Correção: redeclarei `--radius: var(--brand-radius);` dentro de cada um dos 8 blocos `.theme-*` em `web/app/globals.css` — nenhum valor novo, só repeti a referência já usada em `:root`. Reverifiquei ao vivo em 4 nichos (`barbearia`, `salao`, `advocacia`, `certificado`, este via injeção de classe) e o raio passou a seguir o nicho corretamente.

### 2.2 — Fase 4.3: grep de segurança do `useKeckleon()` não retornou vazio

O contrato previa que os 20 consumidores de `useKeckleon()` usassem só `dict`, e mandava escalar se o grep `useKeckleon() | grep -v "{ dict }"` retornasse algo. Retornou 4 linhas — `app-sidebar.tsx`, `category-icon.tsx`, `settings-form.tsx`, `whatsapp-settings.tsx` — que desestruturam `niche`/`meta` além de `dict`.

**Escalei, você aprovou.** Nenhum dos 4 usa `brand`, então a remoção de `NicheBrandConfig`/`brand` era segura; segui exatamente como o resto do item 4.3 descrevia.

### 2.3 — Fase 6.2: `title.template` duplicava "Eliza" em 6 páginas

O trecho exato do contrato (`title: { default: "Eliza", template: "%s | Eliza" }`) faz o Next.js aplicar o template a **qualquer** título string retornado por uma página filha — inclusive títulos que já tinham "Eliza" escrito à mão. Testei ao vivo: `/login` virou "Login | Eliza | Eliza". Encontrei o mesmo padrão em mais 5 arquivos.

**Escalei, você aprovou.** Removi o sufixo/valor literal "Eliza" de:
- `web/app/login/page.tsx` — `"Login | Eliza"` → `"Login"`
- `web/app/(app)/agendamentos/page.tsx` — `"Agenda | Eliza"` → `"Agenda"`
- `web/app/(app)/servicos/page.tsx` — `{ title: "Eliza" }` → `{}`; `` `${servicosTitle} | Eliza` `` → `` `${servicosTitle}` ``
- `web/app/(app)/clientes/page.tsx` — mesmo padrão de `servicos`
- `web/app/demo/start/page.tsx` — `"Testar o Eliza | Demonstração"` → `"Demonstração"` (**única mudança não-mecânica**: aqui "Eliza" estava no meio do texto, não como sufixo; o texto final visível mudou de "Testar o Eliza | Demonstração" para "Demonstração | Eliza", não é só uma deduplicação)

Confirmei depois que `/login` mostra "Login | Eliza" (sem duplicar) e `/demo/start` mostra "Demonstração | Eliza".

### 2.4 — Fase 6.4/6.5: posicionamento do wordmark e selo na sidebar — decisão de julgamento, não leitura literal

O contrato lista `components/layout/app-sidebar.tsx` na tabela de `withDot` do wordmark (6.4) e pede o selo da Sola "no rodapé da sidebar" (6.5), mas — diferente de toda outra instrução do contrato — não dá um diff nem linha exata para onde inserir isso em `app-sidebar.tsx`. Não escalei porque isso não envolve nenhum valor de token (cor/raio/fonte), só posição de layout, e a tarefa pedia explicitamente a criação desses dois componentes.

**Decisão**: criei uma faixa de rodapé nova, abaixo do menu do usuário, com o wordmark (sem ponto) e o selo lado a lado — aditivo, não toca a IA existente do cabeçalho da sidebar (nome da org, chips), que é explicitamente fora de escopo.

### 2.5 — Números de linha desatualizados (não bloquearam, registrados como o contrato pediu)

- `lib/niche-config.ts`: `setupStylesByNiche` estava nas linhas 23–64 (contrato dizia ~23–63)
- `providers/keckleon-provider.tsx`: import de `NicheBrandConfig` na linha 6 (contrato dizia ~5); campo `brand` do `KeckleonContextType` na linha 17 (contrato dizia ~20)
- `app/demo/start/demo-niche-picker.tsx`: `getSetupNicheOptions()` dentro do `.filter(...)` na linha 17, não numa linha isolada

Em todos os casos a instrução continuava inequívoca apesar do desvio de linha, então apliquei sem parar.

---

## 3. Escaladas (§9) e como ficaram

| # | O que escalei | Sua decisão | Resultado |
|---|---|---|---|
| 1 | `--radius` congelado em `:root` (Fase 2) | Redeclarar em cada `.theme-*` | Corrigido, verificado ao vivo em 4 nichos |
| 2 | grep `useKeckleon()` não vazio (Fase 4.3) | Prosseguir | `NicheBrandConfig`/`brand` removidos, `tsc` limpo |
| 3 | `title.template` duplicando "Eliza" (Fase 6.2) | Remover sufixo nas 6 páginas | Corrigido, verificado ao vivo em `/login` e `/demo/start` |

---

## 4. Contagem final de cores fixas (linha de base do contrato: 463)

```
grep -roE "\b(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" web/app web/components --include=*.tsx | wc -l
```

**456 ocorrências em 40 arquivos** — não subiu em relação à linha de base (463), então nenhuma cor fixa nova foi introduzida por esta tarefa. A pequena queda (7 ocorrências) é efeito colateral do que já estava em escopo (ex.: classes trocadas em `demo-niche-picker.tsx`/`setup-form.tsx` na Fase 4), não uma varredura deliberada — essa varredura continua sendo o item R2 do contrato de revisão.

`npx tsc --noEmit` e `npx eslint .` rodados no fim: `tsc` limpo; `eslint` acusa **111 erros e 43 avisos**, mas **nenhum em arquivo tocado por esta tarefa** — todos pré-existentes em `components/ui/sidebar.tsx` (primitivo shadcn, fora de escopo por regra), `preferences-form.tsx`, `whatsapp-settings.tsx`, `settings-form.tsx`, `lib/appointment-config.ts`, `middleware.ts`, `utils/supabase/server.ts`. Confirmei que nenhum desses arquivos foi editado nesta execução.

---

## 5. Notado mas não consertado (fora de escopo)

- **`/setup` não foi testado ao vivo** — a sessão de navegador usada para validação sempre tinha uma organização ativa (via `/demo/start`), e `/setup` redireciona para `/dashboard` nesse caso. A migração de `setup-form.tsx` (Fase 4.2) é estruturalmente idêntica à de `demo-niche-picker.tsx`, que testei e confirmou renderizar as 7 cores corretas — mas não é uma verificação direta de `/setup`.
- **`ThemeToggle` não foi acionado via clique de UI** na Fase 7 — o tour guiado da demo (`TourGuide`, recurso existente, não alterado) ficava sobrepondo os cliques na sessão de teste. Validei o mecanismo por baixo (persistência via `localStorage`, que é exatamente o que `setTheme` do `next-themes` grava) em vez do clique em si.
- **`eslint` com 111 erros / 43 avisos pré-existentes**, nenhum introduzido por esta tarefa (ver §4) — ficam para quem for tratar esse débito técnico, não fazem parte desta refatoração visual.
- **Arquivo residual de um comando `cp` que falhou** durante a Fase 6 (erro de escaping de aspas no Bash) criou um arquivo lixo em `web/public/brand/` com o comando inteiro como nome de arquivo. Detectei e removi antes de finalizar — não sobrou no `git status`, mas registro porque foi um erro operacional meu durante a execução.
- Os itens já listados no próprio contrato como fora de escopo (§3 e §8) — varredura das 463 cores fixas, chips de KPI, reestruturação de `/marcar/[slug]`, IA do dashboard, tab bar mobile, LGPD no formulário público, duplicação de `<h1>` e de UI de upload — **não foram tocados**, como instruído.
