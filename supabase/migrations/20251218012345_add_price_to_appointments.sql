-- Adiciona a coluna de preço na tabela de agendamentos
ALTER TABLE public.appointments 
ADD COLUMN price numeric(10,2);