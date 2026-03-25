# 🏥 Eliza

SaaS multi-tenant para clínicas médicas, com gestão de agenda, pacientes e serviços, projetado para escalar e integrar com múltiplos canais (como WhatsApp e Google Chat).

> Construído com Next.js, Supabase e arquitetura orientada a eventos.

## 🚀 Visão Geral

O Eliza é um sistema completo para clínicas que permite:

- Gestão de profissionais e agenda
- Cadastro inteligente de pacientes
- Página pública de agendamento
- Base preparada para integrações via webhook
- Arquitetura pronta para SaaS multi-tenant


## ⚙️ Funcionalidades

- 📅 Agenda de atendimentos por profissional
- 👨‍⚕️ Gestão de profissionais e serviços
- 👥 Cadastro automático de pacientes (match por documento)
- 🌐 Página pública de agendamento
- 🔄 Atualização de status via eventos/webhooks
- 🔐 Controle de acesso por tipo de usuário (profiles vs professionals)
- 🧩 Arquitetura preparada para integrações externas


## 🏗️ Arquitetura

### Stack

- **Frontend:** Next.js (App Router) + Tailwind + Shadcn UI
- **Backend:** API Routes (Next.js)
- **Banco:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth
- **Infra:** VPS (Nginx + subdomínios)


### 🧠 Conceitos principais

#### 🔹 Multi-tenant (SaaS-ready)

- Estrutura preparada para múltiplas clínicas
- Uso de `organizacao_id` nas entidades principais
- Isolamento de dados por tenant


#### 🔹 Separação de papéis

- `profiles` → controle de acesso (recepcionista, admin, etc)
- `professionals` → quem executa os serviços

Essa separação permite maior flexibilidade na gestão de usuários.


#### 🔹 Página pública de agendamento

- Usuário pode agendar sem login
- Sistema identifica paciente existente ou cria automaticamente
- Fluxo otimizado para conversão


#### 🔹 Lógica baseada em eventos

- Preparado para receber webhooks (ex: Google Chat)
- Atualizações externas de status via comandos


## 🗂️ Estrutura do Projeto

supabase/
migrations/

web/
app/
components/
lib/
services/
utils/


## 🧪 Rodando localmente

```bash
git clone https://github.com/sergioguimas/eliza.git
cd eliza/web
npm install
npm run dev
````

Crie um arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 🧠 Regras de Negócio

* Pacientes são identificados por documento (evita duplicidade)
* Profissionais possuem agenda independente
* Agendamentos podem ser criados:

  * internamente (recepção)
  * externamente (página pública)

* Sistema preparado para sincronização externa via eventos


## 🔐 Segurança

* Uso de Row Level Security (RLS)
* Isolamento por organização (multi-tenant)
* Controle de acesso baseado em perfil


## 💡 Motivação

O Eliza foi criado para resolver problemas reais de gestão em clínicas, com foco em:

* automação de processos
* redução de trabalho manual
* melhoria na experiência do paciente e da equipe


## 👨‍💻 Autor

Sérgio Guimarães
[https://github.com/sergioguimas]
