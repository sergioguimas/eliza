# Keckleon

## O Que É

Keckleon é o mecanismo de adaptação por nicho do Eliza. Ele muda termos, labels, entidades, mensagens e parte da identidade visual conforme `organizations.niche`.

Nichos conhecidos:

- `generico`
- `clinica`
- `psicologia`
- `barbearia`
- `salao`
- `advocacia`
- `certificado`
- `tatuador`
- `manicure`

O schema também cita `oficina`, mas o app atual não expõe esse nicho na enum de criação.

## Arquivos

- `web/lib/dictionaries/base.ts`
- `web/lib/dictionaries/dictionaries.ts`
- `web/lib/dictionaries/niches.ts`
- `web/lib/dictionaries/get-dictionary.ts`
- `web/lib/niche-config.ts`
- `web/providers/keckleon-provider.tsx`

## Entidades

Exemplos:

| Nicho | Cliente | Serviço | Agendamento |
| --- | --- | --- | --- |
| Clínica | Paciente | Procedimento | Consulta |
| Psicologia | Paciente | Atendimento | Sessão |
| Barbearia | Cliente | Serviço | Horário |
| Salão | Cliente | Serviço | Agendamento |
| Advocacia | Cliente | Serviço | Compromisso |
| Tatuador | Cliente | Arte | Sessão |
| Manicure / Nail Designer | Cliente | Serviço | Horário |
| Genérico | Cliente | Serviço | Agendamento |

## Como Usar em Componentes

```tsx
const { dict } = useKeckleon()

const cliente = dict.entities?.cliente || "Cliente"
const servico = dict.entities?.servico || "Serviço"
const agendamento = dict.entities?.agendamento || "Agendamento"
```

Evite:

```tsx
"Paciente"
"Consulta"
"Procedimento"
"Doutor"
"Clínica"
```

Prefira:

```tsx
`${dict.entities?.cliente || "Cliente"}`
`${dict.entities?.agendamento || "Agendamento"}`
`${dict.entities?.servico || "Serviço"}`
```

## Adicionar Novo Nicho

1. Adicionar metadados em `web/lib/niche-config.ts`.
2. Adicionar dicionário em `web/lib/dictionaries/niches.ts`.
3. Atualizar enum em actions que validam nicho, como `web/app/actions/organization.ts`.
4. Atualizar check constraint no Supabase se necessário.
5. Adicionar o bloco `.theme-<nicho>` (claro) e o `.dark .theme-<nicho>` (escuro) em `web/app/globals.css`.
6. Adicionar o mapa de ícones em `web/components/shared/category-icon.tsx`.
7. Adicionar a lista de documentos em `web/lib/niche-documents.ts` (pode ser vazia).
8. Atualizar o tipo `Organization.niche` em `web/app/(app)/layout.tsx`.
9. Se o nicho for promovido comercialmente, incluir em `DEMO_NICHES` e criar o fixture em
   `web/lib/demo/fixtures.ts`.
10. Testar `/setup`, sidebar, `/servicos`, `/agendamentos`, `/clientes`, `/marcar/[slug]`.

## Tokens de Tema

Tema por nicho fica nos blocos `.theme-<nicho>` de `web/app/globals.css` (fonte única, decisão D1 de `docs/CONTRATO_REFATORACAO_VISUAL.md`) e é aplicado no layout autenticado e em `/marcar/[slug]` por CSS variables:

- `--brand-primary`
- `--brand-primary-soft`
- `--brand-primary-border`
- `--brand-primary-foreground`
- `--brand-accent`
- `--brand-accent-soft`
- `--brand-ring`
- `--brand-sidebar-gradient-from`
- `--brand-sidebar-gradient-to`
- `--brand-card-glow`

Cada bloco `.theme-<nicho>` em `web/app/globals.css` define esses valores. Ao criar um
nicho novo, a cor precisa passar 4,5:1 sobre branco, o `--brand-soft-foreground` precisa
passar 4,5:1 sobre `--brand-soft`, e a distância perceptual (ΔE76) para os outros nichos
e para os quatro tokens `--status-*` deve ficar acima de 19, como registrado em
`docs/PESQUISA_NICHOS_VISUAL.md`. O nicho `manicure` (orquídea `296 30% 42%`) foi
escolhido assim: 6,16:1 sobre branco e ΔE76 ≥ 23 de salão e psicologia.

No escuro, cada nicho tem um bloco `.dark .theme-<nicho>`: o primário sobe para ~62% de
luminosidade (≥ 4,65:1 contra o card para `text-primary`) com texto escuro por cima, e
`--brand-soft` vira um tinte escuro do matiz (16%) com `--brand-soft-foreground` claro
(82%). Sem esse bloco o tema claro vaza: chips quase brancos e, no genérico, botão preto
sobre fundo preto.

Tokens que não dependem do nicho, também em `globals.css`:

- `--status-success`, `--status-warning`, `--status-danger`, `--status-info`: estado
  (pago, pendente, cancelado, informação). Texto nessas cores só sobre fundo neutro:
  sobre um tinte `bg-success/10` o contraste cai abaixo de 4,5:1.
- `--cat-1` a `--cat-6`: categóricas, usadas para distinguir profissionais na agenda.
  Não significam status nem marca.

O setup usa tema genérico para garantir contraste antes da organização existir.

## Checklist Anti-Hardcoded

Antes de finalizar uma tela:

- buscar `consulta`, `paciente`, `médico`, `procedimento`, `doutor`, `clínica`;
- confirmar se está dentro de dicionário, exemplo ou documentação;
- trocar textos de UI por `dict.entities`, `dict.messages`, `dict.sections` ou `dict.actions`;
- usar fallback genérico, como `atendimento`.
