BEGIN;

-- O tour da demonstração ganhou 2 passos novos (chegou, pago), separando o que
-- antes era um único "concluir" — de 8 para 10 passos no total. O CHECK
-- original limitava step_number a 1..8, valor exato do desenho original do
-- tour; sem alargar, os inserts de demo_interactions para os passos 9 e 10
-- (timeline, cta) passariam a violar a constraint e falhar silenciosamente
-- (logDemoInteraction engole erro e só loga no console — o tour em si não
-- quebra, só a telemetria desses dois passos para de gravar).

ALTER TABLE public.demo_interactions
  DROP CONSTRAINT IF EXISTS demo_interactions_step_number_check,
  ADD CONSTRAINT demo_interactions_step_number_check
    CHECK (step_number IS NULL OR (step_number BETWEEN 1 AND 10));

COMMIT;
