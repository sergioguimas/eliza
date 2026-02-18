CREATE TABLE IF NOT EXISTS public.estimates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) NOT NULL,
    customer_id uuid REFERENCES customers(id) NOT NULL,
    professional_id uuid REFERENCES professionals(id),
    items jsonb NOT NULL, -- Array de {description, price, quantity}
    total_amount decimal(10,2) NOT NULL,
    notes text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    expiration_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org access estimates" ON estimates FOR ALL USING (organization_id = get_user_org_id());

-- Garante que a coluna notes existe na tabela estimates
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS notes text;

-- Aproveite para garantir que expiration_date também existe (usaremos para a validade)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS expiration_date date;

-- FORÇAR REFRESH DO CACHE (Rode isso se a coluna já existia)
NOTIFY pgrst, 'reload schema';