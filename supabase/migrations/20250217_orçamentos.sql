CREATE TABLE IF NOT EXISTS public.estimates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) NOT NULL,
    customer_id uuid REFERENCES public.customers(id) NOT NULL,
    professional_id uuid REFERENCES public.professionals(id),
    items jsonb NOT NULL,
    total_amount decimal(10,2) NOT NULL,
    status text DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'declined')),
    expiration_date date,
    created_at timestamptz DEFAULT now(),
    notes text
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access estimates" ON public.estimates;
CREATE POLICY "Org access estimates"
ON public.estimates
USING (organization_id = public.get_user_org_id());

NOTIFY pgrst, 'reload schema';
