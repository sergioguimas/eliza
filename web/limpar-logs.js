const http = require('http');

// 👇 CONFIGURAÇÕES
const API_HOST = 'localhost';
const API_PORT = 8082;
const API_KEY = 'medagenda123'; 
// 👇 O nome da sua instância
const INSTANCE_NAME = 'admin-painel-1768703535'; 

// 🔄 CORREÇÃO AQUI: Adicionamos o "webhook: { ... }" em volta dos dados
const payload = JSON.stringify({
  "webhook": {
    "enabled": true,
    "events": ["MESSAGES_UPSERT"], // Só aceita mensagens novas
    "url": "http://host.docker.internal:3000/api/webhooks/whatsapp"
  }
});

const options = {
  hostname: API_HOST,
  port: API_PORT,
  path: `/webhook/set/${INSTANCE_NAME}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': API_KEY,
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log(`🔌 Conectando em http://${API_HOST}:${API_PORT} na instância ${INSTANCE_NAME}...`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("✅ SUCESSO! Configuração aplicada.");
      console.log("👉 Agora o terminal só vai mostrar mensagens novas do WhatsApp.");
    } else {
      console.error(`❌ Erro (${res.statusCode}):`, data);
    }
  });
});

req.on('error', (e) => {
  console.error(`🔥 Erro de conexão: ${e.message}`);
});

req.write(payload);
req.end();