BEGIN;

-- ---------------------------------------------------------------------------
-- B1 (auditoria adversarial 2026-08-28): consumeRateLimit em
-- lib/demo/rate-limit.ts fazia leitura (`select`) seguida de escrita
-- (`upsert`/`update`) em duas idas separadas ao banco, sem transação. Uma
-- rajada concorrente da mesma chave lê "abaixo do teto" em todas as
-- requisições simultâneas antes de qualquer uma delas gravar — 30
-- requisições do mesmo IP passaram todas com teto de 20/h. O comentário
-- original de consumeRateLimit já apontava esta função como o caminho caso
-- o contador precisasse ser exato; agora precisa.
--
-- A função abaixo faz tudo num único `insert ... on conflict do update`
-- atômico: o Postgres serializa updates concorrentes na mesma `key` (a row
-- lock do upsert cuida disso), então o contador nunca perde incremento. A
-- decisão de "permitir ou não" continua do lado da aplicação (compara
-- `count` devolvido com o teto) — a função só garante que o incremento em si
-- é atômico, não decide a política de limite.
--
-- ORDEM DE DEPLOY — invertida em relação à regra padrão do projeto:
-- normalmente código primeiro, migration depois (migration costuma revogar
-- privilégio, e aplicar cedo demais quebraria o código antigo em produção).
-- Aqui é o oposto: esta migration é ADITIVA (só cria uma função nova, não
-- remove nada) e o novo `consumeRateLimit` em rate-limit.ts DEPENDE dela via
-- `supabaseAdmin.rpc(...)`. consumeRateLimit é fail-closed (erro ⇒ nega) —
-- se o código novo for deployado antes desta função existir no banco, TODA
-- criação de demo passaria a ser recusada (a RPC falharia com "function does
-- not exist" e o rate limit negaria por padrão). Portanto: aplicar esta
-- migration no Supabase Studio ANTES de subir o deploy do código que a
-- consome. Sérgio aplica manualmente — não foi rodada por este agente.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_demo_rate_limit(
  p_key text,
  p_window_ms bigint,
  p_max integer
)
RETURNS TABLE (count integer, window_start timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  RETURN QUERY
  INSERT INTO public.demo_rate_limits AS d (key, window_start, count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
        WHEN v_now - d.window_start >= make_interval(secs => p_window_ms / 1000.0)
          THEN 1
        ELSE d.count + 1
      END,
      window_start = CASE
        WHEN v_now - d.window_start >= make_interval(secs => p_window_ms / 1000.0)
          THEN v_now
        ELSE d.window_start
      END,
      updated_at = v_now
  RETURNING d.count, d.window_start;
END;
$$;

-- `demo_rate_limits` tem RLS ligado e nenhuma policy (ver
-- 20260809143000_demo_tenant.sql): só a service role escreve nela hoje. Esta
-- função é SECURITY DEFINER e não checa dono/ownership de `p_key` — qualquer
-- papel com EXECUTE poderia ler/zerar o contador de qualquer outro
-- visitante. Diferente das demais funções SECURITY DEFINER do projeto (que
-- validam auth.uid() internamente), aqui a única barreira é o grant, então
-- ele é restrito explicitamente à service role.
REVOKE ALL ON FUNCTION public.consume_demo_rate_limit(text, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_demo_rate_limit(text, bigint, integer) TO service_role;

COMMIT;
