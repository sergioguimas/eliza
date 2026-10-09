# Atendente Eliza — análise de custo × benefício

> **Data:** 2026-10-09 · **Contexto:** a API de Autoatendimento (F0) está pronta e na `main`
> (`docs/API_AUTOATENDIMENTO.md`, Swagger em `/api/v1/docs`). Falta o consumidor: o serviço
> `eliza-atendente`. Esta análise **reabre D3 e refina D4** do [CHATBOT.md](CHATBOT.md) à luz de
> um fato novo: o Smaug (`redmilab/servicos/smaug`) já é um motor de agente em Go em produção.

## Resumo das recomendações

| Tema | Recomendação | O que se perde |
|---|---|---|
| Custo | Serviço leve na VPS da Sola; o custo real é o LLM, **~US$ 0,01 por conversa** | Custo variável por uso, que precisa entrar no preço do add-on |
| Escalabilidade | **Motor genérico + adaptador por produto.** Reaproveita o código, nunca a instância | Um pouco mais de desenho na F1 |
| Conversação | **LLM de terceiro com ferramentas** (Gemini, plano pago) + atalho determinístico | Dependência de fornecedor e custo por token |
| Stack | **Go, extraindo o motor do Smaug.** A Evolution continua onde está, atrás do Eliza | Perde o compartilhamento direto dos Zod (substituído pela OpenAPI) |
| Segurança | Config no Eliza, segredos na env, auditoria em duas camadas | Uma tabela de log a mais no bot |
| Base de conhecimento | **Nunca banco do Eliza.** Dado vivo pela API, conhecimento estático por tenant, histórico em base do bot | Nenhum RAG na F1 |

---

## 1. Custo — impacto na infraestrutura

### O que roda

| Peça | Onde | Custo de recurso |
|---|---|---|
| `eliza-atendente` | Container na VPS da Sola (`srv1394604`), atrás do Traefik | Go: ~20–40 MB de RAM em repouso, CPU desprezível (só espera rede). Node: ~100–150 MB |
| Instâncias WhatsApp | Evolution API (já existe) | **Nenhuma instância nova.** O bot usa o número que o tenant já conectou para os lembretes |
| Eliza | Mesma VPS | +2 consultas por mensagem recebida (org + config) quando o add-on está ligado; cada ação do bot vira 1 chamada à API |
| Histórico de conversa | Postgres (ver §6) | ~1–3 KB por mensagem. 300 conversas × 10 mensagens = ~5 MB/mês por tenant |
| LLM | API externa | Variável, ver abaixo |

**O gargalo não é o servidor, é o LLM** (latência de 1–3 s por chamada e custo por token).
Um bot em Go atende dezenas de conversas simultâneas com uma fração de núcleo. O que pesa na VPS
continua sendo a Evolution (Baileys mantém uma sessão por número conectado), e o bot não muda isso.

⚠️ **A confirmar:** a única Evolution documentada em `_padroes/` é a da **VPS da Geti**
(`evolution.getisolucoes.com.br`). Se o Eliza usa essa, um produto da Sola depende de infra de
outra empresa — e o bot herdaria essa dependência. Vale conferir `EVOLUTION_API_URL` na VPS da Sola
antes da F1.

### Custo do LLM (preços oficiais Google, out/2026, plano pago, US$ por 1M tokens)

| Modelo | Entrada | Saída | Uso sugerido |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | 0,10 | 0,40 | **Padrão do atendente** |
| Gemini 3.1 Flash-Lite | 0,25 | 1,50 | Alternativa se o 2.5 Lite errar ferramenta |
| Gemini 2.5 Flash | 0,30 | 2,50 (inclui raciocínio) | Escada de fallback (é o que o Smaug usa) |

**Estimativa por conversa** (premissas: prompt + ferramentas + contexto ≈ 5–6 mil tokens por
chamada; ~8 chamadas por conversa, contando as idas às ferramentas; ~200 tokens de saída por
chamada; raciocínio desligado):

| Modelo | Por conversa | 300 conversas/mês por tenant |
|---|---|---|
| 2.5 Flash-Lite | ~US$ 0,006 | ~US$ 2 |
| 2.5 Flash (com raciocínio moderado) | ~US$ 0,03 | ~US$ 9 |

Cache implícito de prompt reduz a entrada repetida (prompt e definição de ferramentas), então a
conta real tende a ficar abaixo. **Mesmo no pior caso, o LLM custa menos que a diferença de preço de
um plano**, desde que o add-on seja cobrado por tenant e tenha teto de conversas.

### Riscos de custo

- **Bot em loop** (o LLM chama ferramenta repetidamente): contido pelos limites `aa-*` da API e por
  um teto de chamadas por turno no próprio bot.
- **Abuso** (alguém conversando sem parar com o número do tenant): limite de turnos por contato/dia
  no bot, além dos da API.
- **Plano gratuito do Gemini:** é gratuito, mas o Google pode usar o conteúdo para melhorar os
  produtos. **Inaceitável para o Eliza** (clínica e psicologia trafegam dado de saúde, LGPD).
  Atendente só em plano pago.

---

## 2. Escalabilidade — exclusivo do Eliza ou reaproveitável?

Há três candidatos ao mesmo motor: o **Atendente Eliza**, o **Smaug** (já em produção) e a
**Helena** (chatbot da Geti, hoje um fluxo N8N parado). Os três têm o mesmo esqueleto: receber
mensagem, deduplicar, agrupar rajadas, chamar o LLM com ferramentas, responder, guardar histórico e
pausar quando um humano assume.

**Recomendação: motor genérico + adaptador por produto, reaproveitando o código e nunca a
instância.**

```txt
motor-atendente (módulo Go)
  ├─ fila, dedupe, debounce, lock por conversa
  ├─ cliente LLM (Gemini) + escada de modelos + teto de chamadas
  ├─ registro de ferramentas + atalho determinístico (fastpath)
  ├─ histórico, pausa por intervenção humana, escalonamento
  └─ áudio (transcrição) e imagem, opcionais
adaptadores
  ├─ eliza:  ferramentas = API de Autoatendimento (cliente gerado da OpenAPI)
  ├─ smaug:  ferramentas = store SQLite local (já existe)
  └─ helena: ferramentas = sistemas da Geti (futuro)
```

- **Por que não uma instância compartilhada:** Sola e Geti são empresas diferentes, com VPS
  separadas por decisão. Uma instância única misturaria dado de clientes das duas. Cada produto sobe
  o seu binário, com a sua base e os seus segredos.
- **Por que não exclusivo do Eliza:** o Smaug já resolveu fila, ferramentas, fastpath, áudio e imagem.
  Reescrever tudo em Node só para o Eliza é pagar duas vezes pelo mesmo motor, e a Helena seria a
  terceira.
- **Trade-off:** extrair o motor do Smaug exige um refactor nele (separar o que é genérico do que é
  financeiro). Fazer isso só quando o Eliza for o segundo consumidor real; não generalizar antes.

---

## 3. Conversação — LLM de terceiro, mini-modelo local ou NLP?

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **LLM de terceiro com tool use** | Entende português livre, áudio e erro de digitação; chama as ferramentas da API; custo baixo (§1) | Dependência de fornecedor; latência de 1–3 s; precisa de plano pago (LGPD) | ✅ **Recomendado** |
| Mini-modelo local (ex.: um modelo pequeno aberto) | Sem custo por token; dado não sai do servidor | A VPS não tem GPU (CPU dá 5–20 s por resposta); modelos pequenos erram muito tool use em PT-BR; manutenção, atualização e avaliação ficam com vocês | ❌ Não compensa no volume atual |
| NLP clássico (intenção + entidades) | Barato, previsível | É o que o webhook de palavra-chave já faz; quebra em conversa livre ("dá pra passar pra quinta de tarde?") | ❌ Como motor principal |

**Recomendação: LLM de terceiro + atalho determinístico na frente.**

- **Atalho (fastpath):** "sim", "confirmo", "cancelar" respondendo a um lembrete são resolvidos sem
  LLM, como o Smaug já faz e como o webhook de palavra-chave já faz hoje. Mais rápido, custo zero, e
  continua funcionando se o LLM cair.
- **LLM:** Gemini 2.5 Flash-Lite como padrão, com escada para um modelo maior só se a avaliação
  mostrar erro de ferramenta. Raciocínio desligado no padrão.
- **Avaliação antes de abrir para tenant real:** uma bateria fixa de ~40 conversas (marcar, remarcar,
  ambíguo, injeção de prompt, fora de escopo) rodada a cada troca de modelo ou de prompt.
- **Reavaliar o modelo local** só se surgir exigência contratual de dado não sair do servidor.

---

## 4. Stack — Go abstraído ou Node no ambiente da Evolution?

A pergunta parte de uma premissa que não vale mais: **o bot não fala com a Evolution.** Pela
arquitetura contratada (C3/D5), a Evolution entrega o webhook ao Eliza, o Eliza encaminha ao bot, e o
bot responde chamando `POST /mensagens` do Eliza. A linguagem da Evolution (Node/Baileys) é
indiferente para o bot.

| | Go (motor do Smaug) | Node/TS (D3 original) |
|---|---|---|
| Reaproveitamento | Motor já pronto e testado no Smaug: LLM, ferramentas, fastpath, fila, áudio, imagem | Escrever do zero |
| Contrato com o Eliza | Cliente gerado da OpenAPI (`/api/v1/autoatendimento/openapi.json`, ex. `oapi-codegen`) | Importa os Zod direto (`web/contracts/autoatendimento`) |
| Recurso na VPS | ~20–40 MB, binário único, imagem Docker pequena | ~100–150 MB, `node_modules` |
| Quem mantém | Sérgio já mantém o Smaug em Go | Mesmo time do Eliza (Next.js) |
| Risco | Divergência de contrato sem tipo compartilhado | Reescrever o que já existe |

**Recomendação: Go, extraindo o motor do Smaug. Reabre a D3 do `CHATBOT.md`.**

- O motivo original da D3 ("compartilha contratos Zod e tipos gerados com o Eliza") perdeu força:
  agora existe a especificação OpenAPI gerada dos mesmos Zod, e dela sai o cliente Go tipado. O
  header `X-Autoatendimento-Versao` já protege contra divergência de versão.
- **Trade-off:** mudança de contrato no Eliza exige regenerar o cliente Go (um comando) em vez de o
  TypeScript acusar na hora. Mitigação: o CI do bot baixa a OpenAPI e falha se o cliente gerado mudar.
- **A Evolution fica onde está.** Trocar de gateway, se um dia acontecer, é assunto do
  `lib/whatsapp/gateway.ts` do Eliza; o bot nem fica sabendo.

---

## 5. Segurança — configuração e auditoria

### Configuração

| O quê | Onde | Quem altera |
|---|---|---|
| Liga/desliga, antecedência, janela, limite de ativos, contato humano, instruções | `autoatendimento_config` (Eliza, já existe) | Hoje Studio; depois tela no painel (owner/admin) |
| Modelo, temperatura, teto de chamadas, prompt base | Env/config do bot (por deploy, não por tenant) | Deploy |
| Segredos (`AUTOATENDIMENTO_API_TOKEN`, `AUTOATENDIMENTO_TICKET_SECRET`, `ATENDENTE_ENCAMINHAMENTO_SECRET`, chave do Gemini) | `.env` na VPS | Deploy; rotação = trocar nos dois lados |

O tenant personaliza **o que** o bot sabe (instruções, políticas); **como** o bot funciona (modelo,
prompt base) é do produto. Isso evita que um tenant quebre o bot ou faça injeção no próprio prompt.

### O que já protege, por construção

- **O bot não escolhe quem atende:** org e telefone vêm do ticket assinado pelo Eliza. Um LLM
  convencido por injeção de prompt ("cancela o horário da Maria") só age sobre quem mandou a mensagem.
- **O bot não tem credencial de banco nem da Evolution:** só o token da API.
- **Toda regra está no Eliza:** grade, antecedência, posse, máquina de status. O bot não consegue
  fazer o que o domínio recusa.
- **Encaminhamento assinado:** o bot confere `X-Eliza-Assinatura` e recusa o que não vier do Eliza.

### Auditoria em duas camadas

1. **No Eliza (já existe):** toda escrita gera `appointment_logs` com `source = 'autoatendimento'`.
   Responde "o que mudou e quando".
2. **No bot (a criar):** por turno — conversa, ferramentas chamadas e argumentos, resposta, modelo,
   tokens e custo estimado. Responde "por que o bot fez isso" e "quanto custou este tenant".

**Pendente que bloqueia tenant real:** retenção do histórico (A5 do `CHATBOT.md`, LGPD). Recomendação:
90 dias de conversa completa, depois só os metadados (sem texto), e apagamento sob pedido do titular.

---

## 6. Base de conhecimento — banco do Eliza ou base dedicada?

**Acesso direto ao banco de produção do Eliza: não.** Já decidido (D2/C3) e agora reforçado pela D9:
o RLS e os grants foram fechados justamente para que toda escrita passe pelo domínio. Um bot com
service role do Eliza anularia isso.

O "conhecimento" do bot tem três naturezas, cada uma num lugar:

| Natureza | Exemplo | Onde fica |
|---|---|---|
| **Dado vivo** | Horários livres, agendamentos do cliente, serviços e preços | **API do Eliza**, consultada a cada turno. Nunca copiar: cópia desatualiza e vira fonte de erro de agenda |
| **Conhecimento estático do tenant** | Endereço, estacionamento, preparo para exame, política de atraso | Hoje `instrucoes_atendimento` (2.000 caracteres) no Eliza. Se crescer, uma tabela de FAQ no Eliza exposta pelo `/contexto`. É do tenant, então fica com o dado do tenant |
| **Estado do bot** | Histórico, pausa humana, dedupe, log de custo | **Base do bot** |

Sobre a base do bot:

- Para o deploy do Eliza, **manter a D4**: schema `atendente` no mesmo Supabase do Eliza, com um papel
  de banco que só enxerga esse schema. Mesmo backup e uma superfície LGPD só.
- Isso **não contradiz** o reaproveitamento (§2): o motor recebe a conexão por configuração. O Smaug
  continua no SQLite dele; a Helena teria a base dela na infra da Geti.
- **RAG/pgvector: não na F1.** O conhecimento estático de um salão ou clínica cabe no prompt. Só
  justifica se algum tenant trouxer material extenso (dezenas de páginas).

---

## Decisões (confirmadas pelo Sérgio em 2026-10-09, registradas no CHATBOT.md)

| # | Questão | Decisão |
|---|---|---|
| E1 | Bot em Go, extraindo o motor do Smaug (reabre D3) | ✅ Confirmada |
| E2 | Motor genérico com adaptador por produto, instância separada por empresa | ✅ Confirmada |
| E3 | Gemini 2.5 Flash-Lite em plano pago como padrão, com fastpath determinístico | ✅ Confirmada |
| E4 | Histórico no schema `atendente` do Supabase do Eliza (mantém D4) | ✅ Confirmada |
| E5 | Retenção: 90 dias de texto, depois só metadados (fecha A5) | ✅ Confirmada |
| E6 | Confirmar qual Evolution o Eliza usa em produção (Sola ou Geti) | ✅ Verificar antes da F1 |

## Fontes de preço

- Google — Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing (consultado em 2026-10-09)
- Google — Gemini API deprecations: https://ai.google.dev/gemini-api/docs/deprecations (2.5 Flash e
  2.5 Flash-Lite sem data de desligamento; uma fonte terceira dizia 16/10/2026, o que não procede)
