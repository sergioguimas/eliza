BEGIN;

-- ---------------------------------------------------------------------------
-- Personalização do atendente por org (sola-agens).
-- Contrato: docs/contratos/autoatendimento/07-ajustes-sola-agens.md §5 (C12, C13).
--
-- Todas anuláveis: NULL = "use o padrão" (o do Eliza, quando existe, montado em
-- lib/autoatendimento/contexto.ts; senão o do atendente). Colunas tipadas com
-- CHECK em vez de um jsonb, pelo mesmo motivo da C6: tipo e limite no banco, e
-- tudo sai junto com o drop da tabela se o add-on morrer.
--
-- Grants e RLS não mudam: authenticated só lê a própria org; escrita pelo
-- Studio. Aditiva, sem ordem de deploy a respeitar.
-- ---------------------------------------------------------------------------

ALTER TABLE public.autoatendimento_config
  ADD COLUMN IF NOT EXISTS atendente_persona text
    CHECK (char_length(atendente_persona) BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS atendente_tom text
    CHECK (char_length(atendente_tom) BETWEEN 1 AND 300),
  ADD COLUMN IF NOT EXISTS pausa_humana_horas integer
    CHECK (pausa_humana_horas BETWEEN 1 AND 168),
  ADD COLUMN IF NOT EXISTS resposta_confirmado text
    CHECK (char_length(resposta_confirmado) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS resposta_cancelado text
    CHECK (char_length(resposta_cancelado) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS resposta_falha_tecnica text
    CHECK (char_length(resposta_falha_tecnica) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS resposta_midia_nao_suportada text
    CHECK (char_length(resposta_midia_nao_suportada) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS resposta_audio_longo text
    CHECK (char_length(resposta_audio_longo) BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS resposta_equipe_sem_contato text
    CHECK (char_length(resposta_equipe_sem_contato) BETWEEN 1 AND 500),
  -- Palavras que, sozinhas, confirmam/cancelam o único agendamento aguardando
  -- confirmação (fastpath do atendente). NULL = lista padrão do atendente.
  ADD COLUMN IF NOT EXISTS palavras_confirmar text[]
    CHECK (cardinality(palavras_confirmar) BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS palavras_cancelar text[]
    CHECK (cardinality(palavras_cancelar) BETWEEN 1 AND 30);

COMMIT;
