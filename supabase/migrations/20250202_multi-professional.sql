-- Tabela para horários recorrentes por profissional
CREATE TABLE professional_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo
    start_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(professional_id, day_of_week) -- Garante apenas uma regra por dia por profissional
);

-- Adicionar RLS para segurança
ALTER TABLE professional_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professional can manage own availability" ON professional_availability
    FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Org can view all availabilities" ON professional_availability
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = professional_availability.professional_id 
            AND profiles.organization_id = get_user_org_id()
        )
    );