BEGIN;

-- O tour da demonstração ganhou passos novos desde o desenho original de 8
-- (chegou, pago, e agora voltar-dashboard, na rodada de correção de
-- 2026-08-15 que reordena prontuário→retorno→pago e move chegou/finalizado
-- pro Dashboard) — 11 passos no total. O CHECK original limitava
-- step_number a 1..8; sem alargar, os inserts de demo_interactions para os
-- passos além do teto passariam a violar a constraint e falhar
-- silenciosamente (logDemoInteraction engole erro e só loga no console — o
-- tour em si não quebra, só a telemetria desses passos para de gravar).
-- Teto em 12, não 11 exato, pra sobrar uma folga pequena e não precisar de
-- outra migration na próxima rodada de ajuste do tour.

ALTER TABLE public.demo_interactions
  DROP CONSTRAINT IF EXISTS demo_interactions_step_number_check,
  ADD CONSTRAINT demo_interactions_step_number_check
    CHECK (step_number IS NULL OR (step_number BETWEEN 1 AND 12));

COMMIT;
