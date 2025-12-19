-- Adiciona coluna de cor com um azul padrão
ALTER TABLE public.services 
ADD COLUMN color text DEFAULT '#2563eb'; -- Blue-600