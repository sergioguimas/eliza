# 🧠 Keckleon --- Engine de Multi-Nicho

## Estrutura

/lib /dictionaries base.ts niches.ts dictionaries.ts get-dictionary.ts

/providers keckleon-provider.tsx

------------------------------------------------------------------------

## Funcionalidades

-   Tradução contextual por nicho
-   UI adaptativa
-   Branding dinâmico
-   Fallback automático
-   Centralização de domínio

------------------------------------------------------------------------

## Uso Client-side

``` tsx
const { entities } = useKeckleon()
<h1>{entities.cliente_plural}</h1>
```

------------------------------------------------------------------------

## Uso Server-side

``` ts
const dict = getDictionary(niche)
const entities = dict.entities
```

------------------------------------------------------------------------

## Como adicionar novos nichos

1.  niches.ts
2.  niche-config.ts
3.  Pronto

------------------------------------------------------------------------

## Pontos de atenção

-   Nunca usar dict.label\_\*
-   Sempre usar fallback
-   Evitar plural manual

------------------------------------------------------------------------

## Debug

``` ts
console.log(niche, entities)
```

------------------------------------------------------------------------

## Exemplo: Agência de Viagens

### niches.ts

``` ts
viagens: buildNiche({
  niche_label: "Agência de Viagens",
  entities: {
    cliente: "Viajante",
    cliente_plural: "Viajantes",
    agendamento: "Reserva",
  }
})
```

### niche-config.ts

``` ts
viagens: {
  id: "viagens",
  label: "Agência de Viagens"
}
```

------------------------------------------------------------------------

## Conclusão

Engine pronta para SaaS multi-nicho e white-label.
