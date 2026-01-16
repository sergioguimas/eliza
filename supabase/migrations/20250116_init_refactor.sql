-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELAS BASE (Tenants & Users)
CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    niche TEXT DEFAULT 'generico', -- 'saude', 'tecnico', etc.
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'active'
);

CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'staff', -- 'owner', 'admin', 'staff'
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TABELAS DE NEGÓCIO (Keckleon Style)
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    document TEXT,
    birth_date DATE,
    gender TEXT,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    price DECIMAL(10,2) DEFAULT 0.00,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    professional_id UUID REFERENCES profiles(id),
    service_id UUID REFERENCES services(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, canceled, completed, no_show
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela renomeada (antiga medical_records)
CREATE TABLE service_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    professional_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    status TEXT DEFAULT 'draft', -- 'draft', 'signed'
    signed_at TIMESTAMPTZ,
    signed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. SEGURANÇA (Row Level Security - RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own org data" ON organizations
    FOR SELECT USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Org members can view profiles" ON profiles
    FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Manage org customers" ON customers
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Manage org services" ON services
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Manage org appointments" ON appointments
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Manage org records" ON service_records
    USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Public read invite by code" ON invitations
  FOR SELECT USING (true);

CREATE POLICY "Admins manage invites" ON invitations
  USING (organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- 5. TRIGGERS DE AUTOMAÇÃO
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    new.email,
    'staff'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();