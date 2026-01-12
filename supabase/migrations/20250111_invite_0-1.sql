-- 1. Limpar regras antigas para evitar conflitos
DROP POLICY IF EXISTS "Admins manage invitations" ON invitations;
DROP POLICY IF EXISTS "Admins and Owners manage invitations" ON invitations;
DROP POLICY IF EXISTS "Public read invite by code" ON invitations;

-- 2. Habilitar RLS (caso não esteja)
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 3. REGRA 1 (Leitura Pública): 
-- Permite que qualquer pessoa (secretária não logada) verifique se o código do convite é válido
CREATE POLICY "Public read invite by code" ON invitations
  FOR SELECT
  USING (true);

-- 4. REGRA 2 (Gestão pelos Donos): 
-- Permite que Donos e Admins criem e vejam os convites da PRÓPRIA empresa
CREATE POLICY "Owners and Admins manage invitations" ON invitations
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );