# Relatório — mídia e vitrine

## F1 — passo 1.1/1.2 (migration e tipos)

**Migration (1.1):** aplicada pelo Opus em 2026-11-10 no projeto Supabase `ttrzlxuqyrqxgbztfmwv`. Versão no banco `20261110000456`, arquivo `20261110120000_midia_categorias_vitrine.sql`. Postgres 17.6 (conferido por `select version()`, ≥ 15 OK para o `on delete set null (media_id)`). Não foi reaplicada neste passo.

**Tipos (1.2):** `web/utils/database.types.ts` regenerado com `generate_typescript_types`. O diff traz as tabelas `org_media`, `service_categories`, `vitrine_items` e a função `renomear_categoria`, além de ruídos sem efeito de schema: reordenação de colunas (`services.addons`, `organizations.brand_palette`), versão do gerador (`PostgrestVersion` 14.5 → 14.1) e formatação dos tipos auxiliares `Tables<>`/`Enums<>`.

**Privilégios (SQL, mesmo projeto):**

Consulta 1 — `information_schema.table_privileges` (anon/authenticated/public):

```
[{"table_name":"org_media","grantee":"authenticated","string_agg":"SELECT"},
 {"table_name":"service_categories","grantee":"authenticated","string_agg":"SELECT"},
 {"table_name":"vitrine_items","grantee":"authenticated","string_agg":"SELECT"}]
```

Resultado: OK. Só `authenticated` com `SELECT`; `anon` e `public` sem linhas.

Consulta 2 — execute de `renomear_categoria`:

```
[{"proname":"renomear_categoria","rolname":"authenticated","has_function_privilege":false},
 {"proname":"renomear_categoria","rolname":"anon","has_function_privilege":false},
 {"proname":"renomear_categoria","rolname":"service_role","has_function_privilege":true}]
```

Resultado: OK. Só `service_role` com execute.

Consulta 3 — RLS:

```
[{"relname":"org_media","relrowsecurity":true},
 {"relname":"service_categories","relrowsecurity":true},
 {"relname":"vitrine_items","relrowsecurity":true}]
```

Resultado: OK. RLS ligado nas três tabelas.
