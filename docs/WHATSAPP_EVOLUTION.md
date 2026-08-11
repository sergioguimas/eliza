# WhatsApp / Evolution API

## Visão Geral

O Eliza integra com Evolution API para QR Code, status de conexão, mensagens automáticas e webhook de respostas.

Usos:

- confirmação de agendamento;
- cancelamento;
- lembretes;
- resumo diário;
- mensagens manuais;
- QR Code de conexão;
- status conectado/desconectado.

## Variáveis

```env
NEXT_PUBLIC_EVOLUTION_API_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

Também podem existir credenciais por organização:

- `organizations.evolution_api_url`
- `organizations.evolution_api_key`

A prioridade no código costuma ser banco da organização e depois variável global.

## Instância

A instância pode ser vinculada ao `slug` da organização.

Fluxo:

1. usuário abre `/configuracoes`, aba WhatsApp;
2. app chama `getWhatsappStatus()`;
3. se desconectado, usuário gera QR Code;
4. app chama `/instance/create` ou `/instance/connect`;
5. usuário escaneia QR Code no WhatsApp;
6. app consulta `/instance/connectionState/{instanceName}`.

## Estados Conectados

Trate como conectado:

- `open`
- `connected`
- `online`

O retorno deve ser normalizado para:

```ts
{ connected: true, status: "connected" }
```

## QR Code

O QR Code pode vir como:

- `data.qrcode.base64`;
- `data.base64` ao consultar connect.

Use `cache: "no-store"` ao consultar status ou QR Code para evitar tela desatualizada.

## Webhook

Rota:

```txt
/api/webhooks/whatsapp/[[...slug]]
```

Palavras conhecidas no fluxo de confirmação/cancelamento:

```txt
sim
nao
não
```

O webhook deve localizar organização/instância, identificar mensagem recebida e atualizar o agendamento quando aplicável.

## Troubleshooting

### Conectado na Evolution, mas UI mostra offline

- Confirmar se o estado retornado é `open`, `connected` ou `online`.
- Confirmar normalização em `web/app/actions/whatsapp-connect.ts`.
- Confirmar `cache: "no-store"`.
- Conferir se a instância consultada é o `slug` correto da organização.

### QR Code não aparece

- Validar `EVOLUTION_API_KEY`.
- Validar URL da Evolution.
- Verificar se a instância já existe.
- Tentar excluir/resetar a instância pela aba WhatsApp.
- Checar logs do container.

### Mensagem não envia

- Confirmar `customer.phone` com DDI.
- Confirmar `organization_id`.
- Confirmar Evolution API acessível pela VPS.
- Conferir se a organização tem credenciais próprias que sobrescrevem as globais.

