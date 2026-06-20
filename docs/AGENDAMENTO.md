# Agendamento

## Fluxo Público

Rota:

```txt
/marcar/[slug]
```

Fluxo:

1. carrega organização pelo `slug`;
2. lista serviços ativos;
3. lista profissionais ativos;
4. usuário escolhe serviço, profissional e data;
5. `getAvailableSlots()` calcula horários disponíveis;
6. usuário informa dados pessoais;
7. `createAppointment()` valida novamente no backend;
8. cria agendamento com status `pending`;
9. envia mensagem de WhatsApp quando possível.

## Fluxo Interno

Rota:

```txt
/agendamentos
```

Agendamentos internos entram como `scheduled`.

## Status

Usados pelo app:

- `pending`
- `scheduled`
- `confirmed`
- `arrived`
- `canceled`
- `completed`
- `no_show`

Ponto de atenção: o `schema_public.sql` atual não lista `arrived` no check constraint de `appointments.status`. Verifique produção antes de usar esse status como definitivo.

## Cálculo de Horários

`getAvailableSlots()` retorna:

```ts
{
  slots: string[]
  message?: string
  reason?: string
}
```

Motivos conhecidos:

- `organization_closed_day`
- `professional_unavailable_day`
- `outside_business_hours`
- `fully_booked`
- `error`

## Regras de Bloqueio

1. Se o dia não está em `organization_settings.days_of_week`:
   - `Este dia não está disponível para agendamentos.`
2. Se o profissional não atende no dia:
   - `O profissional não possui expediente configurado para este dia.`
3. Se o horário está fora do expediente:
   - `Este horário está fora do expediente.`
4. Se o horário cai no intervalo:
   - `Este horário está dentro do intervalo de atendimento.`
5. Se está ocupado:
   - agenda cheia ou horário indisponível.

## Organização

Campos em `organization_settings`:

- `open_hours_start`
- `open_hours_end`
- `lunch_start`
- `lunch_end`
- `days_of_week`
- `appointment_duration`

## Profissional

Campos em `professional_availability`:

- `professional_id`
- `day_of_week`
- `start_time`
- `end_time`
- `break_start`
- `break_end`
- `is_active`

## Timezone

Use sempre:

```txt
America/Sao_Paulo
```

Cuidados:

- Não usar `toLocaleTimeString("pt-BR")` sem `timeZone`.
- Não formatar `timestamptz` em Server Component sem timezone.
- Evitar `toISOString().split("T")[0]` para preencher campo de data local.
- Para entrada de usuário, envie hora de parede local (`YYYY-MM-DDTHH:mm:ss`) quando a action for responsável por converter para UTC.

Helpers úteis:

- `formatSaoPauloTime`
- `formatSaoPauloDayMonth`
- funções de conversão em actions de agendamento.

## Concorrência

O banco possui constraint de sobreposição por profissional. Se dois usuários tentarem agendar o mesmo horário, a action deve tratar erro de conflito e pedir que o usuário escolha outro horário.

