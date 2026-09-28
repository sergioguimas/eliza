-- Nicho Manicure / Nail Designer no Keckleon.
-- Mesmo padrão das migrations anteriores de nicho: recria o CHECK com a lista completa.

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_niche_check;

ALTER TABLE organizations ADD CONSTRAINT organizations_niche_check
CHECK (
  niche IN (
    'clinica',
    'psicologia',
    'barbearia',
    'salao',
    'generico',
    'advocacia',
    'oficina',
    'certificado',
    'tatuador',
    'manicure'
  )
);
