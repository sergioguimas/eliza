-- 1. Adicionar colunas de controle
ALTER TABLE public.medical_records
ADD COLUMN status text default 'draft' check (status in ('draft', 'signed')),
ADD COLUMN signed_at timestamptz,
ADD COLUMN signature_metadata jsonb;

-- 2. Garantir que registros antigos virem rascunho
UPDATE public.medical_records SET status = 'draft' WHERE status IS NULL;

-- 3. SEGURANÇA
-- Removemos a política anterior se existir (apenas segurança para re-runs)
DROP POLICY IF EXISTS "Prevent update of signed records" ON public.medical_records;

CREATE POLICY "Users can update own tenant drafts"
ON public.medical_records FOR UPDATE
USING (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid()) 
  AND
  status = 'draft'
)
WITH CHECK (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  AND
  (status = 'draft' or status = 'signed')
);

-- Permite apagar APENAS se for draft e pertencer ao meu tenant
create policy "Users can delete own tenant drafts"
on public.medical_records for delete
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid()) 
  AND
  status = 'draft'
);