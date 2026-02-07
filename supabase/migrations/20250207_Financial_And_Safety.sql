-- 1. Habilitar extensão para busca espacial/temporal (necessário para o Exclusion Constraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Evolução da Tabela de Agendamentos (Financeiro e Status)
ALTER TABLE public.appointments 
  -- Campos para controle financeiro manual
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'outro')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  
  -- Ajuste de Status para Pré-agendamento (Caso não existam, garantimos a integridade)
  DROP CONSTRAINT IF EXISTS appointments_status_check,
  ADD CONSTRAINT appointments_status_check 
    CHECK (status IN ('scheduled', 'pending', 'confirmed', 'canceled', 'completed', 'no_show'));

-- 3. Blindagem de Concorrência (Prevenção de Double-Booking)
-- Esta constraint garante que NUNCA existam dois agendamentos sobrepostos para o mesmo profissional,
-- ignorando apenas os agendamentos já cancelados.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_professional_overlap_idx,
  ADD CONSTRAINT appointments_professional_overlap_idx EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status != 'canceled');

-- 4. Índices para o Dashboard Financeiro (Performance)
CREATE INDEX IF NOT EXISTS idx_appointments_finance_report 
  ON public.appointments (organization_id, payment_status, payment_method) 
  WHERE (status = 'completed');

-- 5. Comentários para documentação automática
COMMENT ON COLUMN public.appointments.payment_status IS 'Status do pagamento para controle interno do dashboard.';
COMMENT ON COLUMN public.appointments.payment_method IS 'Método de pagamento utilizado pelo cliente.';