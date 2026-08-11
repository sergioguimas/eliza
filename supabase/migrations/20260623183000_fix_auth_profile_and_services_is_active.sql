BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tables and columns that existed in production but were missing from history.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'active'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.services RENAME COLUMN active TO is_active;
  END IF;
END;
$$;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.services
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document_normalized text,
  ADD COLUMN IF NOT EXISTS phone_normalized text;

UPDATE public.customers
SET
  document_normalized = nullif(
    regexp_replace(coalesce(document, ''), '[^0-9A-Za-z]', '', 'g'),
    ''
  ),
  phone_normalized = nullif(
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'),
    ''
  );

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_morning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS whatsapp_instance_name text,
  ADD COLUMN IF NOT EXISTS lunch_start time DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS lunch_end time DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS msg_doctor_daily_summary text,
  ADD COLUMN IF NOT EXISTS msg_appointment_pending text;

ALTER TABLE public.organization_settings
  ALTER COLUMN appointment_duration SET DEFAULT 30;

ALTER TABLE public.service_records
  ADD COLUMN IF NOT EXISTS signature_hash text,
  ADD COLUMN IF NOT EXISTS created_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by_profile_id uuid;

CREATE TABLE IF NOT EXISTS public.appointment_logs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  appointment_id uuid,
  customer_id uuid,
  action text,
  source text,
  raw_message text,
  push_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('doctor_daily_summary', 'patient_day_reminder')),
  appointment_id uuid,
  professional_id uuid,
  customer_id uuid,
  dispatch_date date NOT NULL,
  reference_time text,
  payload jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- Constraints and indexes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check,
  ADD CONSTRAINT appointments_status_check
    CHECK (
      status IN (
        'scheduled',
        'pending',
        'confirmed',
        'arrived',
        'canceled',
        'completed',
        'no_show'
      )
    );

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_professional_overlap_idx,
  ADD CONSTRAINT appointments_professional_overlap_idx
    EXCLUDE USING gist (
      professional_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    )
    WHERE (
      status IN ('pending', 'scheduled', 'confirmed', 'arrived')
    );

ALTER TABLE public.service_records
  DROP CONSTRAINT IF EXISTS service_records_status_check;

UPDATE public.service_records
SET status = 'finalized'
WHERE status = 'final';

ALTER TABLE public.service_records
  ADD CONSTRAINT service_records_status_check
    CHECK (status IN ('draft', 'finalized', 'signed'));

ALTER TABLE public.service_records
  DROP CONSTRAINT IF EXISTS service_records_professional_id_fkey,
  ADD CONSTRAINT service_records_professional_id_fkey
    FOREIGN KEY (professional_id)
    REFERENCES public.professionals(id)
    ON DELETE SET NULL;

ALTER TABLE public.service_records
  DROP CONSTRAINT IF EXISTS service_records_created_by_profile_id_fkey,
  ADD CONSTRAINT service_records_created_by_profile_id_fkey
    FOREIGN KEY (created_by_profile_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.service_records
  DROP CONSTRAINT IF EXISTS service_records_updated_by_profile_id_fkey,
  ADD CONSTRAINT service_records_updated_by_profile_id_fkey
    FOREIGN KEY (updated_by_profile_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.appointment_logs
  DROP CONSTRAINT IF EXISTS appointment_logs_appointment_id_fkey,
  ADD CONSTRAINT appointment_logs_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id)
    ON DELETE CASCADE;

ALTER TABLE public.appointment_logs
  DROP CONSTRAINT IF EXISTS appointment_logs_customer_id_fkey,
  ADD CONSTRAINT appointment_logs_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id);

ALTER TABLE public.notification_dispatches
  DROP CONSTRAINT IF EXISTS notification_dispatches_organization_id_fkey,
  ADD CONSTRAINT notification_dispatches_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE;

ALTER TABLE public.notification_dispatches
  DROP CONSTRAINT IF EXISTS notification_dispatches_appointment_id_fkey,
  ADD CONSTRAINT notification_dispatches_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id)
    ON DELETE CASCADE;

ALTER TABLE public.notification_dispatches
  DROP CONSTRAINT IF EXISTS notification_dispatches_professional_id_fkey,
  ADD CONSTRAINT notification_dispatches_professional_id_fkey
    FOREIGN KEY (professional_id)
    REFERENCES public.professionals(id)
    ON DELETE CASCADE;

ALTER TABLE public.notification_dispatches
  DROP CONSTRAINT IF EXISTS notification_dispatches_customer_id_fkey,
  ADD CONSTRAINT notification_dispatches_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS customers_phone_idx
  ON public.customers (phone);

CREATE INDEX IF NOT EXISTS idx_reminder_sent_at
  ON public.appointments (reminder_sent_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_document
  ON public.customers (organization_id, document_normalized)
  WHERE document_normalized IS NOT NULL
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_phone
  ON public.customers (organization_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatches_unique_doctor
  ON public.notification_dispatches (kind, professional_id, dispatch_date)
  WHERE professional_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatches_unique_patient
  ON public.notification_dispatches (kind, appointment_id, dispatch_date)
  WHERE appointment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Functions.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professional_id uuid;
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT p.id
  INTO v_professional_id
  FROM public.professionals p
  WHERE p.organization_id = new.id
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_professional_id IS NULL THEN
    INSERT INTO public.professionals (
      organization_id,
      name,
      specialty,
      is_active
    )
    VALUES (
      new.id,
      'Atendimento',
      'Atendimento padrão',
      true
    )
    RETURNING id INTO v_professional_id;
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_role text;
  v_organization_id uuid;
  v_organization_id_text text;
BEGIN
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    new.email
  );

  v_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', ''),
    'staff'
  );

  IF v_role NOT IN ('owner', 'admin', 'professional', 'staff') THEN
    v_role := 'staff';
  END IF;

  v_organization_id_text := coalesce(
    nullif(new.raw_user_meta_data->>'organization_id', ''),
    nullif(new.raw_user_meta_data->>'organizationId', '')
  );

  IF v_organization_id_text
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    v_organization_id := v_organization_id_text::uuid;
  ELSE
    v_organization_id := NULL;
  END IF;

  IF v_organization_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = v_organization_id
    )
  THEN
    v_organization_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    organization_id
  )
  VALUES (
    new.id,
    v_full_name,
    new.email,
    v_role,
    v_organization_id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    organization_id = excluded.organization_id,
    updated_at = now();

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_customer_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.document_normalized := nullif(
    regexp_replace(coalesce(new.document, ''), '[^0-9A-Za-z]', '', 'g'),
    ''
  );

  new.phone_normalized := nullif(
    regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'),
    ''
  );

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_public_customer(
  p_organization_id uuid,
  p_name text,
  p_phone text,
  p_document text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_normalized text;
  v_phone_normalized text;
  v_customer public.customers;
BEGIN
  v_document_normalized := nullif(
    regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z]', '', 'g'),
    ''
  );

  v_phone_normalized := nullif(
    regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'),
    ''
  );

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'name é obrigatório';
  END IF;

  IF v_phone_normalized IS NULL THEN
    RAISE EXCEPTION 'phone é obrigatório';
  END IF;

  IF v_document_normalized IS NOT NULL THEN
    SELECT *
    INTO v_customer
    FROM public.customers
    WHERE organization_id = p_organization_id
      AND document_normalized = v_document_normalized
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_customer.id IS NULL THEN
    SELECT *
    INTO v_customer
    FROM public.customers
    WHERE organization_id = p_organization_id
      AND phone_normalized = v_phone_normalized
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_customer.id IS NOT NULL THEN
    UPDATE public.customers
    SET
      name = coalesce(nullif(p_name, ''), name),
      phone = p_phone,
      document = coalesce(nullif(p_document, ''), document),
      email = coalesce(nullif(p_email, ''), email),
      birth_date = coalesce(p_birth_date, birth_date),
      gender = coalesce(nullif(p_gender, ''), gender),
      address = coalesce(nullif(p_address, ''), address),
      notes = coalesce(nullif(p_notes, ''), notes),
      updated_at = now()
    WHERE id = v_customer.id
    RETURNING * INTO v_customer;

    RETURN v_customer;
  END IF;

  INSERT INTO public.customers (
    organization_id,
    name,
    phone,
    document,
    email,
    birth_date,
    gender,
    address,
    notes
  )
  VALUES (
    p_organization_id,
    p_name,
    p_phone,
    p_document,
    p_email,
    p_birth_date,
    p_gender,
    p_address,
    p_notes
  )
  RETURNING * INTO v_customer;

  RETURN v_customer;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_public_appointment(
  p_organization_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_time timestamptz,
  p_name text,
  p_phone text,
  p_document text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_appointment_notes text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
  v_service public.services;
  v_appointment public.appointments;
  v_end_time timestamptz;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  IF p_service_id IS NULL THEN
    RAISE EXCEPTION 'service_id é obrigatório';
  END IF;

  IF p_professional_id IS NULL THEN
    RAISE EXCEPTION 'professional_id é obrigatório';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'start_time é obrigatório';
  END IF;

  SELECT s.*
  INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.organization_id = p_organization_id
    AND coalesce(s.is_active, true) = true
  LIMIT 1;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'Serviço inválido para esta organização';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.professionals pr
    WHERE pr.id = p_professional_id
      AND pr.organization_id = p_organization_id
      AND coalesce(pr.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para esta organização';
  END IF;

  v_customer := public.find_or_create_public_customer(
    p_organization_id := p_organization_id,
    p_name := p_name,
    p_phone := p_phone,
    p_document := p_document,
    p_email := p_email,
    p_birth_date := p_birth_date,
    p_gender := p_gender,
    p_address := p_address,
    p_notes := p_notes
  );

  v_end_time := p_start_time
    + make_interval(mins => coalesce(v_service.duration_minutes, 30));

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.organization_id = p_organization_id
      AND a.professional_id = p_professional_id
      AND a.status IN ('pending', 'scheduled', 'confirmed', 'arrived')
      AND tstzrange(a.start_time, a.end_time, '[)')
        && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'Horário indisponível';
  END IF;

  INSERT INTO public.appointments (
    organization_id,
    customer_id,
    service_id,
    professional_id,
    start_time,
    end_time,
    status,
    notes
  )
  VALUES (
    p_organization_id,
    v_customer.id,
    p_service_id,
    p_professional_id,
    p_start_time,
    v_end_time,
    'pending',
    p_appointment_notes
  )
  RETURNING * INTO v_appointment;

  INSERT INTO public.appointment_logs (
    appointment_id,
    customer_id,
    action,
    source,
    raw_message,
    push_name
  )
  VALUES (
    v_appointment.id,
    v_customer.id,
    'public_request',
    'public_booking_page',
    NULL,
    p_name
  );

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_service_record(
  p_service_record_id uuid
)
RETURNS public.service_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.service_records;
BEGIN
  SELECT *
  INTO v_record
  FROM public.service_records
  WHERE id = p_service_record_id;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Prontuário não encontrado';
  END IF;

  IF v_record.status <> 'draft' THEN
    RAISE EXCEPTION 'Somente prontuários em draft podem ser finalizados';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.professionals pr
    WHERE pr.id = v_record.professional_id
      AND pr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar este prontuário';
  END IF;

  UPDATE public.service_records
  SET
    status = 'finalized',
    updated_at = now(),
    updated_by_profile_id = auth.uid()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_service_record(
  p_service_record_id uuid
)
RETURNS public.service_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.service_records;
BEGIN
  SELECT *
  INTO v_record
  FROM public.service_records
  WHERE id = p_service_record_id;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Prontuário não encontrado';
  END IF;

  IF v_record.status <> 'finalized' THEN
    RAISE EXCEPTION 'Somente prontuários finalizados podem ser assinados';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.professionals pr
    WHERE pr.id = v_record.professional_id
      AND pr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para assinar este prontuário';
  END IF;

  UPDATE public.service_records
  SET
    status = 'signed',
    signed_at = now(),
    signed_by = auth.uid(),
    updated_at = now(),
    updated_by_profile_id = auth.uid()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format(
          'alter table if exists %s enable row level security',
          cmd.object_identity
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %',
            cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_organization();

DROP TRIGGER IF EXISTS trg_normalize_customer_fields ON public.customers;
CREATE TRIGGER trg_normalize_customer_fields
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_customer_fields();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS and policies.
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public appointment requests"
  ON public.appointments;
DROP POLICY IF EXISTS "Público pode cadastrar pacientes"
  ON public.customers;
DROP POLICY IF EXISTS "Público pode buscar pacientes"
  ON public.customers;
DROP POLICY IF EXISTS "Público pode atualizar próprio cadastro"
  ON public.customers;
DROP POLICY IF EXISTS "Professional can manage own availability"
  ON public.professional_availability;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone"
  ON public.organizations;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.organizations
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public services are viewable by everyone"
  ON public.services;
CREATE POLICY "Public services are viewable by everyone"
ON public.services
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Public professionals are viewable by everyone"
  ON public.professionals;
CREATE POLICY "Public professionals are viewable by everyone"
ON public.professionals
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Public select appointments"
  ON public.appointments;
CREATE POLICY "Public select appointments"
ON public.appointments
FOR SELECT
TO anon
USING (status = 'pending');

DROP POLICY IF EXISTS "Disponibilidade visível publicamente"
  ON public.professional_availability;
CREATE POLICY "Disponibilidade visível publicamente"
ON public.professional_availability
FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage all or Professional manage own availability"
  ON public.professional_availability;
CREATE POLICY "Admin manage all or Professional manage own availability"
ON public.professional_availability
TO authenticated
USING (
  (
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ) IN ('owner', 'admin')
  OR professional_id IN (
    SELECT pr.id
    FROM public.professionals pr
    WHERE pr.user_id = auth.uid()
  )
)
WITH CHECK (
  (
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ) IN ('owner', 'admin')
  OR professional_id IN (
    SELECT pr.id
    FROM public.professionals pr
    WHERE pr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org can view all availabilities"
  ON public.professional_availability;
CREATE POLICY "Org can view all availabilities"
ON public.professional_availability
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.professionals pr
    JOIN public.profiles pf
      ON pf.organization_id = pr.organization_id
    WHERE pr.id = professional_availability.professional_id
      AND pf.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin total access or Professional self view"
  ON public.professionals;
CREATE POLICY "Admin total access or Professional self view"
ON public.professionals
FOR SELECT
USING (
  (
    SELECT profiles.role
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  ) = 'owner'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admin total update or Professional self update"
  ON public.professionals;
CREATE POLICY "Admin total update or Professional self update"
ON public.professionals
FOR UPDATE
USING (
  (
    SELECT profiles.role
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  ) = 'owner'
  OR user_id = auth.uid()
)
WITH CHECK (
  (
    SELECT profiles.role
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  ) = 'owner'
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Professionals can view service_records"
  ON public.service_records;
CREATE POLICY "Professionals can view service_records"
ON public.service_records
FOR SELECT
USING (
  organization_id = (
    SELECT profiles.organization_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Professionals can update service_records"
  ON public.service_records;
CREATE POLICY "Professionals can update service_records"
ON public.service_records
FOR UPDATE
USING (
  organization_id = (
    SELECT profiles.organization_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
  AND status = 'draft'
)
WITH CHECK (
  organization_id = (
    SELECT profiles.organization_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org pode ver prontuarios"
  ON public.service_records;
CREATE POLICY "Org pode ver prontuarios"
ON public.service_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id = service_records.organization_id
  )
);

DROP POLICY IF EXISTS "Profissional pode criar prontuario"
  ON public.service_records;
CREATE POLICY "Profissional pode criar prontuario"
ON public.service_records
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id IN (
    SELECT pr.id
    FROM public.professionals pr
    WHERE pr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Profissional edita proprio draft"
  ON public.service_records;
CREATE POLICY "Profissional edita proprio draft"
ON public.service_records
FOR UPDATE
TO authenticated
USING (
  status = 'draft'
  AND professional_id IN (
    SELECT pr.id
    FROM public.professionals pr
    WHERE pr.user_id = auth.uid()
  )
)
WITH CHECK (status = 'draft');

DROP POLICY IF EXISTS "Nao permitir delete"
  ON public.service_records;
CREATE POLICY "Nao permitir delete"
ON public.service_records
FOR DELETE
TO authenticated
USING (false);

NOTIFY pgrst, 'reload schema';

COMMIT;
