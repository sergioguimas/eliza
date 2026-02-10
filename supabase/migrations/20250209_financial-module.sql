CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE, -- Se nulo, está "A Pagar"
  category TEXT DEFAULT 'Geral', -- Aluguel, Salários, Insumos, etc.
  status TEXT DEFAULT 'pending', -- 'pending' ou 'paid'
  created_at TIMESTAMPTZ DEFAULT now()
);