-- Permite que usuários autenticados atualizem a PRÓPRIA clínica (tenant)
CREATE POLICY "Users can update their own tenant"
ON public.tenants
FOR UPDATE
USING (
  id IN (
    SELECT tenant_id 
    FROM public.profiles 
    WHERE profiles.id = auth.uid()
  )
);