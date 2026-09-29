# 03 — Catálogo e horários livres

> TO-BE · Contrato v1 · Zod: `catalogo.ts` · ver [README](README.md)

Estes três endpoints não exigem cliente identificado: um desconhecido pode
perguntar preço e horário antes de se cadastrar, como na página pública.

## `lib/domain/catalogo.ts`

Extraído de `app/marcar/[slug]/page.tsx`, que passa a chamar estas funções.

```ts
listarServicosAtivos(orgId): Promise<Servico[]>
listarProfissionaisAtivos(orgId): Promise<Profissional[]>
```

- `services` com `is_active = true`, ordenado por `title`. Colunas `id, title,
  description, duration_minutes, price`.
- `professionals` com `is_active = true`, ordenado por `name`. Colunas `id,
  name, specialty`. **Nunca** `phone` nem `license_number`.
- `preco`: `price` como número; `null` se `price` for nulo. Preço 0 continua 0.

`GET /servicos` e `GET /profissionais`: sem query; devolvem as listas.

**Não existe vínculo serviço ↔ profissional no schema.** Todo profissional
ativo é tratado como apto a todo serviço, como a página pública já faz hoje.
Não inventar o vínculo; se for preciso, é decisão de produto.

## `lib/domain/horarios.ts`

Extraído de `actions/get-available-slots.ts`. A action continua existindo como
wrapper fino (a página pública a usa), com a mesma assinatura.

```ts
calcularHorariosLivres(params: {
  orgId: string
  profissionalId: string
  data: string            // AAAA-MM-DD local
  duracaoMinutos: number  // do serviço
  naoAntesDe?: Date       // agora + antecedência; omitido = sem corte
  ignorarAgendamentoId?: string  // usado na remarcação (04)
}): Promise<{ horarios: string[]; motivoVazio: MotivoSemHorario | null }>
```

Mantém toda a regra atual (dias da org, expediente da org ∩ do profissional,
almoço da org, pausa do profissional, agendamentos não cancelados, grade no
passo de `appointment_duration` da org), com estas mudanças:

1. **O slot testado tem a duração do serviço**, não `appointment_duration`.
   Hoje um serviço de 60 min é oferecido às 11:30 com almoço às 12:00, porque
   o teste só olha 30 min. O passo da grade continua sendo
   `appointment_duration`; só muda a janela verificada.
2. **`naoAntesDe`:** descarta horários cujo início (convertido para UTC) é
   anterior. Se sobrou nada **só** por isso, `motivoVazio =
   "antecedencia_minima"`.
3. **`ignorarAgendamentoId`:** exclui esse agendamento da lista de ocupados,
   para remarcar para um horário que se sobrepõe ao atual.
4. **Comparação de ocupado em minutos do dia**, como hoje. Continua correto
   porque a consulta já é recortada no dia local.

A página pública passa a chamar com a duração do serviço escolhido e
`naoAntesDe = agora`. Isso também corrige ela oferecer horários já passados no
dia de hoje. É uma mudança de comportamento **desejada**: registrar no
CHANGELOG.

## `GET /api/v1/autoatendimento/horarios`

Query validada por `HorariosQuery`: `servicoId`, `data` e `profissionalId`
opcional.

1. O serviço precisa ser ativo e da org do ticket. Se não for, `NAO_ENCONTRADO`.
2. Se veio `profissionalId`, ele precisa ser ativo e da org (`NAO_ENCONTRADO`).
   Sem ele, usar todos os ativos.
3. `data` < hoje local, ou > hoje + `janelaMaximaDias` → `FORA_DA_JANELA`.
4. Para cada profissional: `calcularHorariosLivres` com a duração do serviço
   e `naoAntesDe = agora + antecedenciaMinimaMinutos`.
5. `porProfissional` na ordem de `listarProfissionaisAtivos`, **incluindo** quem
   ficou sem horário (com `motivoVazio`), para o atendente poder dizer "com a
   Dra. X não há, com o Dr. Y há".

## Aceite

- [ ] `/marcar/[slug]` mostra os mesmos serviços e profissionais de antes.
- [ ] Na página pública, serviço com a mesma duração da org → mesmos horários
      de antes, exceto os já passados hoje.
- [ ] Serviço de 60 min, org com 30 min e almoço 12–13: 11:30 **não** aparece;
      11:00 aparece.
- [ ] `servicoId` de outra org → 404.
- [ ] `data` de ontem e `data` além da janela → 422 `FORA_DA_JANELA`.
- [ ] Hoje às 16:10 com antecedência de 120 min: primeiro horário ≥ 18:10.
- [ ] Profissional sem expediente no dia aparece com `horarios: []` e motivo.
- [ ] Resposta não contém telefone nem registro do profissional.
