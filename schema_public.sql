--
-- PostgreSQL database dump
--

-- Consolidated from the production schema dump (PostgreSQL 17.6) on 2026-06-24.
-- Validated by replaying all migrations on PostgreSQL 15.3.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: service_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    professional_id uuid,
    content text NOT NULL,
    status text DEFAULT 'draft'::text,
    tags text[],
    signed_at timestamp with time zone,
    signed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    appointment_id uuid,
    signature_hash text,
    created_by_profile_id uuid,
    updated_by_profile_id uuid,
    CONSTRAINT service_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'signed'::text])))
);


--
-- Name: finalize_service_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_service_record(p_service_record_id uuid) RETURNS public.service_records
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    document text,
    birth_date date,
    gender text,
    address text,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    document_normalized text,
    phone_normalized text
);


--
-- Name: find_or_create_public_customer(uuid, text, text, text, text, date, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS public.customers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_user_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: handle_new_organization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;


--
-- Name: normalize_customer_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    service_id uuid,
    professional_id uuid,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text,
    notes text,
    price numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'pending'::text,
    paid_at timestamp with time zone,
    reminder_sent_at timestamp with time zone,
    reminder_morning_sent_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT appointments_payment_method_check CHECK ((payment_method = ANY (ARRAY['dinheiro'::text, 'pix'::text, 'cartao_credito'::text, 'cartao_debito'::text, 'outro'::text]))),
    CONSTRAINT appointments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partially_paid'::text, 'refunded'::text]))),
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'pending'::text, 'confirmed'::text, 'arrived'::text, 'canceled'::text, 'completed'::text, 'no_show'::text])))
);


--
-- Name: COLUMN appointments.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.appointments.payment_method IS 'Método de pagamento utilizado pelo cliente.';


--
-- Name: COLUMN appointments.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.appointments.payment_status IS 'Status do pagamento para controle interno do dashboard.';


--
-- Name: request_public_appointment(uuid, uuid, uuid, timestamp with time zone, text, text, text, text, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_appointment_notes text DEFAULT NULL::text) RETURNS public.appointments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
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


--
-- Name: sign_service_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sign_service_record(p_service_record_id uuid) RETURNS public.service_records
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;


--
-- Name: appointment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    appointment_id uuid,
    customer_id uuid,
    action text,
    source text,
    raw_message text,
    push_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    professional_id uuid,
    items jsonb NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    expiration_date date,
    created_at timestamp with time zone DEFAULT now(),
    notes text,
    CONSTRAINT estimates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    payment_date date,
    category text DEFAULT 'Geral'::text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text,
    code text NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    used_count integer DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_dispatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    kind text NOT NULL,
    appointment_id uuid,
    professional_id uuid,
    customer_id uuid,
    dispatch_date date NOT NULL,
    reference_time text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_dispatches_kind_check CHECK ((kind = ANY (ARRAY['doctor_daily_summary'::text, 'patient_day_reminder'::text])))
);


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    organization_id uuid NOT NULL,
    open_hours_start time without time zone DEFAULT '08:00:00'::time without time zone,
    open_hours_end time without time zone DEFAULT '18:00:00'::time without time zone,
    days_of_week integer[] DEFAULT '{1,2,3,4,5}'::integer[],
    appointment_duration integer DEFAULT 30,
    msg_appointment_reminder text,
    msg_appointment_created text,
    msg_appointment_canceled text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    whatsapp_instance_name text,
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone,
    lunch_end time without time zone DEFAULT '13:00:00'::time without time zone,
    msg_doctor_daily_summary text,
    msg_appointment_pending text
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    niche text NOT NULL,
    evolution_api_url text,
    evolution_api_key text,
    whatsapp_instance_name text,
    whatsapp_status text DEFAULT 'disconnected'::text,
    stripe_customer_id text,
    subscription_status text DEFAULT 'active'::text,
    plan text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizations_niche_check CHECK ((niche = ANY (ARRAY['clinica'::text, 'psicologia'::text, 'barbearia'::text, 'salao'::text, 'generico'::text, 'advocacia'::text, 'oficina'::text, 'certificado'::text, 'tatuador'::text])))
);


--
-- Name: professional_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    professional_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    break_start time without time zone,
    break_end time without time zone,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT professional_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: professionals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professionals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    license_number text,
    specialty text,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    organization_id uuid,
    full_name text,
    email text,
    avatar_url text,
    role text DEFAULT 'staff'::text,
    professional_license text,
    bio text,
    color text DEFAULT '#3b82f6'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'professional'::text, 'staff'::text])))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    price numeric(10,2) DEFAULT 0.00,
    color text DEFAULT '#3b82f6'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_logs appointment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_professional_overlap_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_overlap_idx EXCLUDE USING gist (professional_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'arrived'::text])));


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_code_key UNIQUE (code);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: notification_dispatches notification_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: professional_availability professional_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_pkey PRIMARY KEY (id);


--
-- Name: professional_availability professional_availability_professional_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_day_of_week_key UNIQUE (professional_id, day_of_week);


--
-- Name: professionals professionals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: service_records service_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: customers_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_phone_idx ON public.customers USING btree (phone);


--
-- Name: idx_appointments_finance_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_finance_report ON public.appointments USING btree (organization_id, payment_status, payment_method) WHERE (status = 'completed'::text);


--
-- Name: idx_customers_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_not_deleted ON public.customers USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_reminder_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminder_sent_at ON public.appointments USING btree (reminder_sent_at);


--
-- Name: notification_dispatches_unique_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_dispatches_unique_doctor ON public.notification_dispatches USING btree (kind, professional_id, dispatch_date) WHERE (professional_id IS NOT NULL);


--
-- Name: notification_dispatches_unique_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_dispatches_unique_patient ON public.notification_dispatches USING btree (kind, appointment_id, dispatch_date) WHERE (appointment_id IS NOT NULL);


--
-- Name: uq_customers_org_document; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customers_org_document ON public.customers USING btree (organization_id, document_normalized) WHERE ((document_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: uq_customers_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customers_org_phone ON public.customers USING btree (organization_id, phone_normalized) WHERE ((phone_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: organizations on_organization_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();


--
-- Name: customers trg_normalize_customer_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_customer_fields BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_fields();


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_logs appointment_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_logs appointment_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: appointments appointments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: appointments appointments_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: estimates estimates_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: estimates estimates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: estimates estimates_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id);


--
-- Name: expenses expenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_dispatches notification_dispatches_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: notification_dispatches notification_dispatches_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: notification_dispatches notification_dispatches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_dispatches notification_dispatches_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: professional_availability professional_availability_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;


--
-- Name: professionals professionals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: professionals professionals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: service_records service_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: service_records service_records_created_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_records service_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: service_records service_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: service_records service_records_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- Name: service_records service_records_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.profiles(id);


--
-- Name: service_records service_records_updated_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_updated_by_profile_id_fkey FOREIGN KEY (updated_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: services services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: professional_availability Admin manage all or Professional manage own availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage all or Professional manage own availability" ON public.professional_availability TO authenticated USING (((( SELECT p.role
   FROM public.profiles p
  WHERE (p.id = auth.uid())) = ANY (ARRAY['owner'::text, 'admin'::text])) OR (professional_id IN ( SELECT pr.id
   FROM public.professionals pr
  WHERE (pr.user_id = auth.uid()))))) WITH CHECK (((( SELECT p.role
   FROM public.profiles p
  WHERE (p.id = auth.uid())) = ANY (ARRAY['owner'::text, 'admin'::text])) OR (professional_id IN ( SELECT pr.id
   FROM public.professionals pr
  WHERE (pr.user_id = auth.uid())))));


--
-- Name: professionals Admin total access or Professional self view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin total access or Professional self view" ON public.professionals FOR SELECT USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- Name: professionals Admin total update or Professional self update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin total update or Professional self update" ON public.professionals FOR UPDATE USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid()))) WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- Name: invitations Admins manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage invites" ON public.invitations USING (((organization_id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: professional_availability Disponibilidade visível publicamente; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Disponibilidade visível publicamente" ON public.professional_availability FOR SELECT TO anon USING ((is_active = true));


--
-- Name: organizations New users can create org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "New users can create org" ON public.organizations FOR INSERT WITH CHECK (true);


--
-- Name: appointments Org access appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access appointments" ON public.appointments USING ((organization_id = public.get_user_org_id()));


--
-- Name: customers Org access customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access customers" ON public.customers USING ((organization_id = public.get_user_org_id()));


--
-- Name: estimates Org access estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access estimates" ON public.estimates USING ((organization_id = public.get_user_org_id()));


--
-- Name: service_records Org access records delete drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access records delete drafts" ON public.service_records FOR DELETE TO authenticated USING (((organization_id = public.get_user_org_id()) AND (status = 'draft'::text)));


--
-- Name: service_records Org access records insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access records insert" ON public.service_records FOR INSERT TO authenticated WITH CHECK ((organization_id = public.get_user_org_id()));


--
-- Name: service_records Org access records select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access records select" ON public.service_records FOR SELECT TO authenticated USING ((organization_id = public.get_user_org_id()));


--
-- Name: service_records Org access records update drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access records update drafts" ON public.service_records FOR UPDATE TO authenticated USING (((organization_id = public.get_user_org_id()) AND (status = 'draft'::text))) WITH CHECK ((organization_id = public.get_user_org_id()));


--
-- Name: services Org access services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access services" ON public.services USING ((organization_id = public.get_user_org_id()));


--
-- Name: professional_availability Org can view all availabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org can view all availabilities" ON public.professional_availability FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.professionals pr
     JOIN public.profiles pf ON ((pf.organization_id = pr.organization_id)))
  WHERE ((pr.id = professional_availability.professional_id) AND (pf.id = auth.uid())))));


--
-- Name: professionals Public professionals are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public professionals are viewable by everyone" ON public.professionals FOR SELECT USING ((is_active = true));


--
-- Name: organizations Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.organizations FOR SELECT USING (true);


--
-- Name: invitations Public read invite by code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read invite by code" ON public.invitations FOR SELECT USING (true);


--
-- Name: appointments Public select appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public select appointments" ON public.appointments FOR SELECT TO anon USING ((status = 'pending'::text));


--
-- Name: services Public services are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public services are viewable by everyone" ON public.services FOR SELECT USING ((is_active = true));


--
-- Name: organization_settings Update org settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update org settings" ON public.organization_settings USING ((organization_id = public.get_user_org_id()));


--
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- Name: organizations Users can update own org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own org" ON public.organizations FOR UPDATE USING ((id = public.get_user_org_id()));


--
-- Name: organizations Users can view own org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own org" ON public.organizations FOR SELECT USING ((id = public.get_user_org_id()));


--
-- Name: professionals Usuários veem profissionais da mesma org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem profissionais da mesma org" ON public.professionals FOR SELECT USING ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: organization_settings View org settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View org settings" ON public.organization_settings FOR SELECT USING ((organization_id = public.get_user_org_id()));


--
-- Name: profiles View profiles in same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View profiles in same org" ON public.profiles FOR SELECT USING (((organization_id = public.get_user_org_id()) OR (id = auth.uid())));


--
-- Name: appointment_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_dispatches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_dispatches ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: professional_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: professionals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: service_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

