alter table public.organizations 
add column niche text default 'clinica' check (niche in ('clinica', 'barbearia', 'salao', 'generico'));