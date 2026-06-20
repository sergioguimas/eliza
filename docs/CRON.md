# Cron e Lembretes

## Rota

```txt
GET /api/cron/send-reminders
```

## Autenticação

Header obrigatório:

```txt
Authorization: Bearer <CRON_SECRET>
```

Variável:

```env
CRON_SECRET=
CRON_TZ=America/Sao_Paulo
```

## Timezone

O timezone operacional é:

```txt
America/Sao_Paulo
```

O código usa helpers com `Intl.DateTimeFormat` para calcular dia e hora no Brasil.

## Fluxos

### `processDoctorDailySummaries`

Envia resumo diário para profissionais.

Regras atuais:

- roda apenas quando a hora em São Paulo é `7`;
- busca agendamentos do dia com status `scheduled` ou `confirmed`;
- agrupa por organização e telefone do profissional;
- usa `msg_doctor_daily_summary` quando configurada.

Variáveis do template:

- `{name}`
- `{date}`
- `{appointments}`
- `{agenda}` como alias legado;
- `{count}`

### `processPatientMorningReminders`

Envia lembrete para clientes com agendamento na próxima hora.

Variáveis do template:

- `{name}`
- `{service}`
- `{date}`
- `{time}`
- `{professional}`

## Exemplo de Curl

Local:

```bash
curl -i \
  -H "Authorization: Bearer dev-secret" \
  http://localhost:3000/api/cron/send-reminders
```

Produção:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://eliza.sgdev.cloud/api/cron/send-reminders
```

## Problemas Comuns

### 401 unauthorized

- `CRON_SECRET` ausente no servidor.
- Header `Authorization` errado.
- Espaços extras no token.

### Resumo diário não envia

- A hora atual em São Paulo não é a hora configurada.
- Profissional sem telefone.
- Agendamentos sem status `scheduled` ou `confirmed`.
- Já foi marcado `reminder_morning_sent_at`.

### Lembrete de cliente não envia

- Agendamento não está dentro da próxima hora.
- Cliente sem telefone.
- Status não é `scheduled` ou `confirmed`.
- `reminder_sent_at` já preenchido.

### Rodando fora do horário

- Ajustar agendador externo para `America/Sao_Paulo`.
- Confirmar `CRON_TZ=America/Sao_Paulo`.
- Conferir logs com `timestamp_sp` retornado pela rota.

