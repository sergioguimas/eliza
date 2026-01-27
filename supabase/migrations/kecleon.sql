ALTER TABLE organizations DROP CONSTRAINT organizations_niche_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_niche_check 
CHECK (niche IN ('clinica', 'barbearia', 'salao', 'generico', 'advocacia', 'oficina', 'certificado'));