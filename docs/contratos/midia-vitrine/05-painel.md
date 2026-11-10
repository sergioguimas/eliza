# 05 — Painel: seletor de fotos, "Categorias e fotos" e Vitrine

> **TO-BE** · Fase F2 · executor: Sonnet · revisão: Opus (+ revisão de UX no celular, opcional, com Fable)

## 0. Quem usa e onde

A Deborah usa o painel **pelo celular**, e esse é o caso que manda no desenho. Tudo precisa funcionar a
partir de 360 px de largura, com o polegar: alvos de toque com pelo menos 44 px e nada que dependa de hover
ou de arrastar com precisão (reordenar é com botões ↑/↓, não drag-and-drop).

Só `owner` e `admin` veem estas telas. Para `professional`, a seção não aparece e o item de menu também não.
As server actions recusam do mesmo jeito (`exigirGestorDaOrg`).

Textos: em português, fixos. Se houver chave do keckleon que sirva (ex.: `entities.servico_plural`), usar;
senão, texto fixo. Componentes: os de `components/ui` (shadcn: Dialog, Tabs, Button, Input) e `sonner`
para os avisos. **Dependência nova permitida: `react-easy-crop`** (versão exata). Nenhuma outra.

## 1. Componente `MediaPicker` (`web/components/midia/media-picker.tsx`)

Um Dialog com duas abas, reaproveitado pelas duas telas.

```ts
type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  titulo: string                    // ex.: "Foto da categoria Alongamento"
  selecionadaId?: string | null
  onEscolher: (m: MidiaPainel) => void
}
```

**Aba "Minhas fotos"** (abre nesta se a biblioteca tiver alguma foto):
- Grade 3:4, 3 colunas no celular e 5 no desktop, com a variante **480** e `loading="lazy"`. A selecionada fica marcada.
- Tocar numa foto seleciona. Botão fixo no rodapé: "Usar esta foto".
- Menu de cada foto (⋯): "Editar descrição" e "Excluir da biblioteca". Excluir com `usos > 0` mostra
  onde ela está sendo usada e não exclui. Com `usos = 0`, confirmar com "A foto sai da biblioteca. Isso não
  pode ser desfeito pelo painel."
- Contador "23 de 80 fotos".

**Aba "Enviar nova"**:
1. `<input type="file" accept="image/*">`. No iPhone, isso já oferece a galeria e a câmera.
2. Decodificar no navegador com `createImageBitmap(file, { imageOrientation: "from-image" })`. Se falhar →
   "Não consegui abrir essa foto. Tente uma em JPG ou PNG."
3. Reduzir para no máximo **2560 px** no lado maior, num canvas → `toBlob("image/jpeg", 0.9)` (MV8).
   Isso resolve o HEIC (o Safari decodifica) e corta o envio de 6 MB para cerca de 1 MB.
4. Recorte com `react-easy-crop`: `aspect={3/4}`, zoom por pinça e por slider, grade de terços.
   Guardar `croppedArea` **em porcentagem** → converter para frações 0..1 → campo `recorte`.
   Se o recorte resultar em menos de 480 px no lado menor, avisar antes de enviar: "Essa foto é pequena e vai ficar borrada no site."
5. Campo "Descreva a foto" (obrigatório, 3–200), com a ajuda: "Para quem usa leitor de tela e para o Google.
   Ex.: Unhas amendoadas com francesinha e brilho."
6. "Enviar" → `POST /api/painel/midia` com barra de progresso (XHR `upload.onprogress`; `fetch` não dá
   progresso de upload). Ao terminar, a foto entra no topo de "Minhas fotos" já selecionada, e o
   `onEscolher` é chamado direto (um toque a menos).
7. Erros da rota viram toast com a `message` do envelope. 429 → "Muitos envios seguidos. Tente de novo em X minutos."

## 2. Seção "Categorias e fotos" em `app/(app)/servicos/page.tsx`

No **topo** da página de serviços, acima da lista, colapsável (aberta por padrão se houver categoria sem foto).
Componente `web/components/services/categorias-fotos.tsx` (client), com dados de `listarCategorias`.

Cada categoria é uma linha:

```
[foto 3:4 60px] Alongamento               [↑] [↓]
                3 serviços · Trocar foto · Renomear
```

- Sem foto: miniatura com borda tracejada e "Sem foto: o site usa a padrão".
- "Trocar foto" → `MediaPicker` → `definirFotoCategoria`. Mais "Tirar foto" quando já tem uma.
- ↑/↓ movem na hora (otimista) e gravam com `reordenarCategorias` depois de 600 ms sem novo toque
  (debounce: subir três posições = uma gravação). Se falhar, volta a ordem e mostra um toast.
- "Renomear" → Dialog com campo (1–40) → `renomearCategoria`. Aviso: "Muda a categoria em todos os
  serviços dela." Se o nome novo já existir: "Os serviços vão para a categoria X, que já existe, e vale a foto dela."
- Texto curto no topo da seção: "A ordem e as fotos daqui aparecem no seu site."
- Sem nenhuma categoria: "Dê uma categoria aos seus serviços (no botão de editar) para agrupá-los no site."

## 3. Página Vitrine `app/(app)/vitrine/page.tsx`

Item de menu **"Vitrine"** em `components/layout/app-sidebar.tsx`, logo depois de Serviços, só para owner/admin.

- Cabeçalho: "Vitrine" + "Fotos do seu trabalho que aparecem no seu site." + botão "Adicionar foto".
- Lista (uma coluna no celular, grade de 3 no desktop). Cada item:
  `[foto]` · legenda (edição inline, 1–60) · categoria (select: categorias existentes + "Nenhuma") ·
  interruptor "No site" (`ativo`) · ↑/↓ · remover (🗑, confirma "Sai da vitrine; a foto continua na biblioteca").
- "Adicionar foto" → `MediaPicker` → pede a legenda (Dialog curto, já com a descrição da foto como sugestão,
  cortada em 60) → `adicionarItem`.
- Contador "9 de 24 no site". Ao chegar a 24, o botão desabilita com a explicação.
- Edição inline grava ao sair do campo (blur) ou no Enter, com indicador "salvo".
- Vazio: "Sua vitrine está vazia. Enquanto isso, o site mostra as fotos que vieram com ele."

## 4. Desempenho do painel

- Miniaturas sempre da variante 480, com `width`/`height` e `loading="lazy"`.
- `react-easy-crop` carregado só dentro da aba "Enviar nova" (`next/dynamic`, `ssr: false`). Não entra no bundle da página de serviços.
- Nada de polling: depois de cada ação, `revalidatePath` mais o estado local.

## 5. Aceite do 05

- [ ] No **celular** (DevTools 375 px com toque **e** um aparelho real): enviar foto da galeria, recortar, descrever, usar na categoria. No iPhone, com uma foto HEIC.
- [ ] Voltar para a foto anterior pela aba "Minhas fotos".
- [ ] Reordenar com 3 toques seguidos grava uma vez só (conferir na aba de rede).
- [ ] Renomear categoria e conferir os serviços na lista.
- [ ] Vitrine: adicionar, editar legenda, trocar categoria, desativar, reordenar, remover.
- [ ] Login como `professional`: nem a seção, nem o menu, e as actions recusam.
- [ ] `react-easy-crop` ausente do JS inicial de `/servicos` (conferir o chunk).
- [ ] `tsc --noEmit` sem erro novo.
