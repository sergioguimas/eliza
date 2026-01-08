-- Adiciona colunas que podem estar faltando
alter table customers 
add column if not exists address text,
add column if not exists birth_date date;

-- Garante que a coluna active existe (caso não exista)
-- Se ela já existe como boolean, esse comando não fará nada
alter table customers 
add column if not exists active boolean default true;