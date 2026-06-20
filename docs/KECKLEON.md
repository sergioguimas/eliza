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
5. Testar `/setup`, sidebar, `/servicos`, `/agendamentos`, `/clientes`, `/marcar/[slug]`.

## Tokens de Tema

Tema por nicho fica em `web/lib/niche-config.ts` e é aplicado no layout autenticado por CSS variables:

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

O setup usa tema genérico para garantir contraste antes da organização existir.

## Checklist Anti-Hardcoded

Antes de finalizar uma tela:

- buscar `consulta`, `paciente`, `médico`, `procedimento`, `doutor`, `clínica`;
- confirmar se está dentro de dicionário, exemplo ou documentação;
- trocar textos de UI por `dict.entities`, `dict.messages`, `dict.sections` ou `dict.actions`;
- usar fallback genérico, como `atendimento`.
