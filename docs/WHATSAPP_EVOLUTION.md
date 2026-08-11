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
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

`NEXT_PUBLIC_EVOLUTION_API_URL` ainda é aceita como fallback por compatibilidade
com o deploy atual, mas está em vias de aposentadoria: todo uso é server-side, e
o prefixo `NEXT_PUBLIC_` só serve para expor a URL no bundle do browser.

O servidor Evolution é **único para todo o sistema**. Não existe servidor por
organização — as colunas `organizations.evolution_api_url` / `evolution_api_key`
foram removidas (migration `20260809170000`). A resolução do servidor vive em
`web/lib/evolution.ts`, e é o único lugar que lê essas envs.

Infra conhecida:

```txt
Evolution API via Tailscale: 100.64.0.2:8080
```

## Instância

A instância é o que separa um tenant do outro: é o número de onde a mensagem
sai. A fonte única é `organizations.whatsapp_instance_name`.

O `slug` define o nome da instância **apenas na primeira conexão**. A partir do
momento em que a coluna está gravada, ela manda — trocar o slug depois não
desvincula o número já pareado na Evolution.

Nunca derive a instância do slug na hora de enviar. Sem instância gravada, o
envio falha explicitamente; jamais caia em uma instância global (isso faria o
cliente de uma org receber mensagem do número de outra).

Fluxo:

1. usuário abre `/configuracoes`, aba WhatsApp;
2. app chama `getWhatsappStatus()`;
3. se desconectado, usuário gera QR Code;
4. app chama `/instance/create` ou `/instance/connect`;
5. app grava `organizations.whatsapp_instance_name`;
6. usuário escaneia QR Code no WhatsApp;
7. app consulta `/instance/connectionState/{instanceName}`.

O reset (`deleteWhatsappInstance`) apaga a instância na Evolution e zera a
coluna — sem vínculo, a org volta a não enviar.

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
- Conferir `organizations.whatsapp_instance_name` — e lembrar que ela pode
  divergir do `slug` atual se o slug mudou depois da conexão.

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
- Conferir `organizations.whatsapp_instance_name`. Se estiver nula, o envio é
  ignorado de propósito (log `🚫 Envio ignorado: organização sem WhatsApp
  conectado`) — a org precisa conectar um número.

