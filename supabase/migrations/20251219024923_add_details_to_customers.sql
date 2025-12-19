-- Adiciona colunas de gênero e observações na tabela de clientes
ALTER TABLE public.customers
ADD COLUMN gender text, -- pode ser 'masculino', 'feminino', 'outro'
ADD COLUMN notes text;  -- texto livre para anotações gerais