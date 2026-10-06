# 01 — Configuração do add-on

> TO-BE · Contrato v1 · ver [README](README.md)

## Tabela `autoatendimento_config`

Uma linha por org. **Sem linha = add-on desligado.** O código nunca cria a
linha sozinho.

Migration `supabase/migrations/<timestamp>_autoatendimento_config.sql`:

```sql
create table public.autoatendimento_config (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  ativo boolean not null default false,
  antecedencia_minima_minutos integer not null default 120
    check (antecedencia_minima_minutos between 0 and 10080),
  janela_maxima_dias integer not null default 60
    check (janela_maxima_dias between 1 and 365),
  max_agendamentos_ativos integer not null default 3
    check (max_agendamentos_ativos between 1 and 20),
  contato_humano_telefone text,
  instrucoes_atendimento text
    check (char_length(instrucoes_atendimento) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.autoatendimento_config enable row level security;

revoke all on public.autoatendimento_config from anon, authenticated;

grant select on public.autoatendimento_config to authenticated;

create policy "Org members read own autoatendimento config"
  on public.autoatendimento_config
  for select to authenticated
  using (organization_id = public.get_user_org_id());
```

**Por que assim:**

- **`on delete cascade`.** Remover uma org já falha por FK em sete tabelas
  (memória do projeto, `lib/demo/cleanup.ts`). Esta não entra na lista.
- **`authenticated` só lê, e só a própria org.** Ninguém escreve pelo client.
  Na F0 a escrita é pelo Studio; quando existir tela, ela vai por server
  action com service role e checagem de papel owner/admin. É o mesmo padrão
  de `organizations` depois de 2026-08-11: a trava de escrita é o grant, não a
  policy.
- **`contato_humano_telefone` fica fora do SELECT do client?** Não precisa:
  é da própria org e ela mesma cadastrou.
- **Demo:** org com `is_demo = true` nunca é encaminhada (06), com ou sem
  linha aqui.

Trigger de `updated_at`: reusar `public.update_updated_at_column()`, a mesma
função de `update_appointments_updated_at`:

```sql
create trigger update_autoatendimento_config_updated_at
  before update on public.autoatendimento_config
  for each row execute function public.update_updated_at_column();
```

## Leitura pelo domínio

`lib/autoatendimento/config.ts`:

```ts
carregarConfig(orgId: string): Promise<ConfigAutoatendimento | null>
```

Lê com service role e devolve `null` se não há linha **ou** se
`ativo = false`. Quem recebe `null` responde `ADDON_INACTIVE`.

Mapeamento para `Contexto.politica` (02): colunas em camelCase
(`antecedencia_minima_minutos` → `antecedenciaMinimaMinutos` etc.).

**Sem `status_inicial`** (revisão de 2026-10-06, D8): o agendamento do bot
nasce **sempre** `pending`, igual à página pública. Não é configurável por org. `contato_humano_telefone` **não** vai para
o contexto; só o Eliza o usa (escalonamento).

## Variáveis de ambiente (Eliza)

| Env | Uso |
|---|---|
| `AUTOATENDIMENTO_API_TOKEN` | Bearer que o atendente envia. ≥ 32 bytes aleatórios. |
| `AUTOATENDIMENTO_TICKET_SECRET` | HMAC do ticket. Só no Eliza. ≥ 32 bytes. |
| `ATENDENTE_URL` | Base do serviço, ex.: `http://eliza-atendente:4100`. Vazia = encaminhamento desligado globalmente. |
| `ATENDENTE_ENCAMINHAMENTO_SECRET` | HMAC do encaminhamento Eliza → atendente. |

Nenhuma dessas é `NEXT_PUBLIC_*`. Documentar em `docs/DEPLOY.md` e no
`.env.example`, se houver. Ao gerar os valores, **não** repetir o erro do
`CRON_SECRET=123456`: usar `openssl rand -hex 32`.

## Aceite

- [ ] Migration aplica limpa num banco com os dados atuais.
- [ ] Como `authenticated` de outra org: `select` na tabela volta vazio.
- [ ] Como `authenticated` da própria org: `update` falha com 42501.
- [ ] Como `anon`: `select` falha com 42501.
- [ ] Apagar uma org de teste com linha aqui não falha por esta FK.
- [ ] `carregarConfig` devolve `null` para sem linha e para `ativo=false`.
- [ ] `database.types.ts` regenerado, não editado à mão.
