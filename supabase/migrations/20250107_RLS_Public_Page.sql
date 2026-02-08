-- 1. Organizações: Público pode ver o nome e slug para carregar a página
CREATE POLICY "Public profiles are viewable by everyone" ON organizations
  FOR SELECT USING (true);

-- 2. Serviços: Público vê apenas serviços ativos
CREATE POLICY "Public services are viewable by everyone" ON services
  FOR SELECT USING (active = true);

-- 3. Profissionais: Público vê apenas profissionais ativos
CREATE POLICY "Public professionals are viewable by everyone" ON professionals
  FOR SELECT USING (is_active = true);

-- 4. Agendamentos: Permitir INSERT anônimo apenas com status 'pending'
CREATE POLICY "Allow public appointment requests" ON appointments
  FOR INSERT TO anon 
  WITH CHECK (status = 'pending');

-- Permite que qualquer pessoa veja a disponibilidade dos profissionais
CREATE POLICY "Disponibilidade visível publicamente" ON professional_availability
  FOR SELECT USING (is_active = true);

-- Permite que o público insira novos pacientes
CREATE POLICY "Público pode cadastrar pacientes" ON customers
  FOR INSERT TO anon WITH CHECK (true);

-- Permite que o público busque se o paciente já existe (necessário para o upsert)
CREATE POLICY "Público pode buscar pacientes" ON customers
  FOR SELECT USING (true);

-- Adiciona a restrição de unicidade para o documento do paciente
ALTER TABLE public.customers ADD CONSTRAINT customers_document_unique UNIQUE (document);

-- Algumas bibliotecas de cliente exigem o SELECT após o INSERT para retornar o objeto
CREATE POLICY "Público pode buscar pacientes" ON customers
  FOR SELECT TO anon USING (true);

-- Permite que o público atualize os próprios dados (necessário para o upsert)
DROP POLICY IF EXISTS "Público pode atualizar próprio cadastro" ON customers;
CREATE POLICY "Público pode atualizar próprio cadastro" ON customers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);