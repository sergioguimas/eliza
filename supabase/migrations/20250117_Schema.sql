-- ==============================================================================
-- 0. RESET TOTAL (LIMPANDO A CASA)
-- ==============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_user_org_id();

DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS service_records CASCADE;
DROP TABLE IF EXISTS service_notes CASCADE; -- Para garantir que o antigo suma
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS organization_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS whatsapp_instances CASCADE;

-- ==============================================================================
-- 1. EXTENSÕES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELAS CORE
-- ==============================================================================

CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    niche TEXT NOT NULL CHECK (niche IN ('clinica', 'barbearia', 'salao', 'advocacia', 'generico')),
    
    -- CONFIGURAÇÃO EVOLUTION API (WHATSAPP)
    evolution_api_url TEXT, 
    evolution_api_key TEXT,
    whatsapp_instance_name TEXT,
    whatsapp_status TEXT DEFAULT 'disconnected', 
    
    -- PAGAMENTOS
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'free',
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'professional', 'staff')),
    professional_license TEXT, 
    bio TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. FUNÇÕES UTILITÁRIAS
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ==============================================================================
-- 4. DEMAIS TABELAS
-- ==============================================================================

CREATE TABLE organization_settings (
    organization_id UUID REFERENCES organizations(id) PRIMARY KEY,
    open_hours_start TIME DEFAULT '08:00',
    open_hours_end TIME DEFAULT '18:00',
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5}',
    appointment_duration INTEGER DEFAULT 60, -- Ajustei para 60 (padrão comum), mas pode ser 30
    
    -- Mensagens (Renomeado para bater com o código route.ts)
    msg_appointment_reminder TEXT, 
    
    -- Outros templates (mantidos genéricos ou renomeie conforme uso futuro)
    msg_appointment_created TEXT,
    msg_appointment_canceled TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    document TEXT,
    birth_date DATE,
    gender TEXT,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    title TEXT NOT NULL, -- Código usa 'title'
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price DECIMAL(10,2) DEFAULT 0.00,
    color TEXT DEFAULT '#3b82f6', -- Código usa 'color'
    active BOOLEAN DEFAULT true,  -- Código usa 'active'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    service_id UUID REFERENCES services(id),
    professional_id UUID REFERENCES profiles(id), -- Código usa 'professional_id'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'confirmed', 'canceled', 'completed', 'no_show')),
    notes TEXT,
    price DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE service_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    professional_id UUID REFERENCES profiles(id), -- Quem criou
    content TEXT NOT NULL, 
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'final')),
    tags TEXT[],
    signed_at TIMESTAMPTZ,
    signed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    code TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================================================================
-- 5. SEGURANÇA (RLS)
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policies Organizations
CREATE POLICY "Users can view own org" ON organizations
    FOR SELECT USING (id = get_user_org_id());
    
CREATE POLICY "Users can update own org" ON organizations
    FOR UPDATE USING (id = get_user_org_id());
    
CREATE POLICY "New users can create org" ON organizations
    FOR INSERT WITH CHECK (true);

-- Policies Settings
CREATE POLICY "View org settings" ON organization_settings
    FOR SELECT USING (organization_id = get_user_org_id());

CREATE POLICY "Update org settings" ON organization_settings
    FOR ALL USING (organization_id = get_user_org_id());

-- Policies Profiles
CREATE POLICY "View profiles in same org" ON profiles
    FOR SELECT USING (organization_id = get_user_org_id() OR id = auth.uid());

CREATE POLICY "Update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Policies Customers, Services, Appointments, Records
CREATE POLICY "Org access customers" ON customers
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "Org access services" ON services
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "Org access appointments" ON appointments
    FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "Org access records" ON service_records
    FOR ALL USING (organization_id = get_user_org_id());

-- Policies Invitations
CREATE POLICY "Public read invite by code" ON invitations
    FOR SELECT USING (true);

CREATE POLICY "Admins manage invites" ON invitations
    FOR ALL USING (
        organization_id = get_user_org_id() 
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- ==============================================================================
-- 6. TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'staff'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_organization() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_organization();