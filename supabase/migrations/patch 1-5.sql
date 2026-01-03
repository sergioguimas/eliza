-- 1. Remove a regra antiga que limitava os nomes
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;

-- 2. Cria a nova regra aceitando 'scheduled'
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('scheduled', 'pending', 'confirmed', 'canceled', 'completed', 'no_show'));