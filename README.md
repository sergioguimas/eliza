# 📘 Documentação Técnica - Eliza SaaS

Este documento descreve a arquitetura, esquema de banco de dados e fluxos principais do sistema de gestão multi-tenant (SaaS) Eliza.

## 🛠 Tech Stack

* **Frontend/Backend:** Next.js 14+ (App Router, Server Actions)
* **Linguagem:** TypeScript
* **Banco de Dados:** PostgreSQL (via Supabase)
* **Auth & Realtime:** Supabase Auth
* **Estilização:** Tailwind CSS + ShadcnUI
* **Integrações:** Evolution API (WhatsApp), Stripe (Pagamentos - *Placeholder*)

---

## 🗄️ Esquema do Banco de Dados (Database Schema)

O sistema utiliza uma arquitetura **Multi-tenant** baseada em `organization_id`. Todas as consultas sensíveis são protegidas por RLS (Row Level Security) garantindo que um usuário só acesse dados da sua própria organização.

### 1. Núcleo (Core)

* **`organizations`**: A entidade raiz.
* `slug`: Identificador único na URL (ex: `eliza.com/barbearia-top`).
* `evolution_api_url` / `key`: Credenciais para envio de WhatsApp.
* `niche`: Define o dicionário de termos (ex: 'paciente' vs 'cliente').


* **`profiles`**: Extensão da tabela `auth.users`.
* `role`: 'owner', 'admin', 'professional', 'staff'.
* `organization_id`: Vincula o usuário a uma empresa.



### 2. Operacional

* **`services`** (Procedimentos):
* `title`: Nome do serviço.
* `duration_minutes`: Usado para calcular o `end_time` no agendamento.
* `color`: Hexadecimal para exibição no calendário.
* `active`: Booleano para soft-delete/arquivamento.


* **`customers`** (Clientes/Pacientes):
* Dados cadastrais e histórico.
* Validação de duplicidade por `phone` ou `document` dentro da mesma organização.



### 3. Agendamento & Prontuários

* **`appointments`**:
* `professional_id`: Quem vai atender (pode ser diferente de quem agendou).
* `status`: 'scheduled', 'confirmed', 'canceled', 'completed', 'no_show'.
* Relaciona-se com `customers` e `services`.


* **`service_records`** (Prontuários/Evoluções):
* Substitui antigas tabelas de notas.
* `status`: 'draft' (rascunho editável) ou 'signed' (assinado/imutável).
* `signed_at` / `signed_by`: Rastreabilidade jurídica simples.



---

## ⚡ Fluxos Críticos e Server Actions

### 1. Criação de Agendamento (`create-appointment.ts`)

1. Recebe `start_time` e `service_id`.
2. Busca a duração do serviço para calcular `end_time`.
3. **Verificação de Conflito:**
* Busca na tabela `appointments` se existe intersecção de horário.
* Ignora agendamentos com status 'canceled'.
* Filtra pelo `professional_id` se especificado.


4. Insere no banco e dispara, assincronamente, a confirmação via WhatsApp.

### 2. Cron Job de Lembretes (`api/cron/send-reminders/route.ts`)

* **Frequência:** Executado diariamente (via Cron do Vercel ou Supabase).
* **Lógica de Fuso Horário:**
* O servidor roda em UTC.
* Calculamos `nowBrazil = subHours(nowUtc, 3)`.
* Buscamos agendamentos do dia seguinte inteiro (`startOfDay` a `endOfDay`).


* **Template Engine:** Substitui `{name}`, `{time}`, `{service}` na mensagem configurada em `organization_settings`.
* **Envio:** Usa a `evolution_api_url` cadastrada na organização.

### 3. Prontuário Eletrônico (`service-records.ts`)

* Permite salvar rascunhos (`draft`).
* Ao "Assinar" (`sign-service-record.ts`), o registro é travado (`signed`) e recebe carimbo de tempo. Apenas o autor (`professional_id`) pode assinar.

---

## 🛡️ Segurança e Tipagem (TypeScript)

### Problema Conhecido: Tipagem "Never"

Devido a dessincronia entre o banco local e a geração de tipos automática, o TypeScript pode acusar erro de `Property does not exist on type 'never'`.

### Solução Aplicada: "Blindagem"

Utilizamos casting explícito (`as any`) nas Server Actions para garantir que o build ocorra com sucesso, confiando que o banco de dados (Supabase) validará os dados em tempo de execução.

**Exemplo:**

```typescript
// Em vez de: supabase.from('services').insert(...)
// Usamos:
(supabase.from('services') as any).insert(...)

```

### 🚀 Solução Definitiva (Recomendado)

Para remover os `as any` e ter type-safety real, execute no terminal:

```bash
npx supabase gen types typescript --project-id SEU_ID > utils/database.types.ts

```

---

## 🚀 Como Rodar o Projeto

1. **Variáveis de Ambiente (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... (Para Admin tasks)
CRON_SECRET=... (Para proteger a rota de lembretes)
NEXT_PUBLIC_GOD_EMAIL=admin@sistema.com

```


2. **Instalar dependências:**
```bash
npm install

```


3. **Rodar servidor de desenvolvimento:**
```bash
npm run dev

```


4. **Resetar Banco de Dados (Se necessário):**
* Vá no SQL Editor do Supabase.
* Rode o script `20250117_reset.sql`.



---

## ✅ Checklist de Implantação (Deploy)

1. [ ] Criar projeto no Supabase.
2. [ ] Rodar o script SQL de criação de tabelas.
3. [ ] Configurar Auth (Email/Password) no Supabase.
4. [ ] Configurar Storage (se houver upload de avatar).
5. [ ] Deploy na Vercel importando as variáveis de ambiente.
6. [ ] Configurar Cron Job na Vercel para chamar `/api/cron/send-reminders?key=SEU_SECRET` diariamente às 08:00 BRT.