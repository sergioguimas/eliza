-- 1. Tabela de Convites
CREATE TABLE invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL, -- O código do link (ex: A8J-92K)
  role TEXT NOT NULL DEFAULT 'staff', -- O cargo que a pessoa vai ganhar
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL, -- Data de validade
  used_count INT DEFAULT 0 -- Quantas pessoas usaram (opcional, para estatística)
);

-- 2. Segurança (RLS)
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Regra: Apenas ADMINS podem ver/criar convites da própria empresa
CREATE POLICY "Admins and Owners manage invitations" ON invitations
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'owner') -- Agora aceita os dois!
    )
  );

-- Regra: Qualquer pessoa (mesmo deslogada) pode ler o convite se tiver o código
-- (Necessário para a página de "Aceitar Convite" validar se o código existe)
CREATE POLICY "Public read invite by code" ON invitations
  FOR SELECT
  USING (true);

-- 1. Adicionar a coluna email na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Preencher o email dos usuários que JÁ existem (Backfill)
-- O usuário 'postgres' do editor tem permissão para ler auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 3. Atualizar a função do Trigger (Gatilho) para salvar o email de NOVOS usuários
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    'staff',
    new.email -- <--- Adicionamos isso aqui
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email; -- Garante que atualiza se já existir
  RETURN new;
END;
$$;