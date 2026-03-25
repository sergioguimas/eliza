--
-- PostgreSQL database dump
--

\restrict C5Mi3rRk0C5HPe1ExwKFuZv1OlVbkpsM3exKS7Swvkvsll0V1CAMEv2ztfcvcTR

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-18 23:04:54

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 139 (class 2615 OID 32071)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


SET default_table_access_method = heap;

--
-- TOC entry 398 (class 1259 OID 33468)
-- Name: service_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    content text NOT NULL,
    status text DEFAULT 'draft'::text,
    tags text[],
    signed_at timestamp with time zone,
    signed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    signature_hash text,
    appointment_id uuid,
    professional_id uuid,
    created_by_profile_id uuid,
    updated_by_profile_id uuid,
    CONSTRAINT service_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'signed'::text, 'final'::text])))
);


--
-- TOC entry 687 (class 1255 OID 99758)
-- Name: finalize_service_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_service_record(p_service_record_id uuid) RETURNS public.service_records
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_record public.service_records;
begin
  select *
    into v_record
  from public.service_records
  where id = p_service_record_id;

  if v_record.id is null then
    raise exception 'Prontuario nao encontrado';
  end if;

  if v_record.status <> 'draft' then
    raise exception 'Somente prontuarios em draft podem ser finalizados';
  end if;

  if not exists (
    select 1
    from public.professionals pr
    where pr.id = v_record.professional_id
      and pr.user_id = auth.uid()
  ) then
    raise exception 'Sem permissao para finalizar este prontuario';
  end if;

  update public.service_records
  set
    status = 'finalized',
    updated_at = now(),
    updated_by_profile_id = auth.uid()
  where id = v_record.id
  returning * into v_record;

  return v_record;
end;
$$;


--
-- TOC entry 395 (class 1259 OID 33404)
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
-- TOC entry 435 (class 1255 OID 99746)
-- Name: find_or_create_public_customer(uuid, text, text, text, text, date, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS public.customers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_document_normalized text;
  v_phone_normalized text;
  v_customer public.customers;
begin
  v_document_normalized :=
    nullif(regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z]', '', 'g'), '');

  v_phone_normalized :=
    nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');

  if p_organization_id is null then
    raise exception 'organization_id é obrigatório';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'name é obrigatório';
  end if;

  if v_phone_normalized is null then
    raise exception 'phone é obrigatório';
  end if;

  if v_document_normalized is not null then
    select *
      into v_customer
    from public.customers
    where organization_id = p_organization_id
      and document_normalized = v_document_normalized
      and deleted_at is null
    limit 1;
  end if;

  if v_customer.id is null then
    select *
      into v_customer
    from public.customers
    where organization_id = p_organization_id
      and phone_normalized = v_phone_normalized
      and deleted_at is null
    limit 1;
  end if;

  if v_customer.id is not null then
    update public.customers
    set
      name = coalesce(nullif(p_name, ''), name),
      phone = p_phone,
      document = coalesce(nullif(p_document, ''), document),
      email = coalesce(nullif(p_email, ''), email),
      birth_date = coalesce(p_birth_date, birth_date),
      gender = coalesce(nullif(p_gender, ''), gender),
      address = coalesce(nullif(p_address, ''), address),
      notes = coalesce(nullif(p_notes, ''), notes),
      updated_at = now()
    where id = v_customer.id
    returning * into v_customer;

    return v_customer;
  end if;

  insert into public.customers (
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
  values (
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
  returning * into v_customer;

  return v_customer;
end;
$$;


--
-- TOC entry 564 (class 1255 OID 33385)
-- Name: get_user_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- TOC entry 516 (class 1255 OID 33533)
-- Name: handle_new_organization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id);
  RETURN new;
END;
$$;


--
-- TOC entry 643 (class 1255 OID 33531)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- TOC entry 693 (class 1255 OID 99742)
-- Name: normalize_customer_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.document_normalized :=
    nullif(regexp_replace(coalesce(new.document, ''), '[^0-9A-Za-z]', '', 'g'), '');

  new.phone_normalized :=
    nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');

  return new;
end;
$$;


--
-- TOC entry 397 (class 1259 OID 33437)
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
    CONSTRAINT appointments_payment_method_check CHECK ((payment_method = ANY (ARRAY['dinheiro'::text, 'pix'::text, 'cartao_credito'::text, 'cartao_debito'::text, 'outro'::text]))),
    CONSTRAINT appointments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partially_paid'::text, 'refunded'::text]))),
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'pending'::text, 'confirmed'::text, 'canceled'::text, 'completed'::text, 'no_show'::text])))
);


--
-- TOC entry 4295 (class 0 OID 0)
-- Dependencies: 397
-- Name: COLUMN appointments.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.appointments.payment_method IS 'Método de pagamento utilizado pelo cliente.';


--
-- TOC entry 4296 (class 0 OID 0)
-- Dependencies: 397
-- Name: COLUMN appointments.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.appointments.payment_status IS 'Status do pagamento para controle interno do dashboard.';


--
-- TOC entry 598 (class 1255 OID 99751)
-- Name: request_public_appointment(uuid, uuid, uuid, timestamp with time zone, text, text, text, text, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_appointment_notes text DEFAULT NULL::text) RETURNS public.appointments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_customer public.customers;
  v_service public.services;
  v_appointment public.appointments;
  v_end_time timestamptz;
begin
  if p_organization_id is null then
    raise exception 'organization_id é obrigatório';
  end if;

  if p_service_id is null then
    raise exception 'service_id é obrigatório';
  end if;

  if p_professional_id is null then
    raise exception 'professional_id é obrigatório';
  end if;

  if p_start_time is null then
    raise exception 'start_time é obrigatório';
  end if;

  select *
    into v_service
  from public.services
  where id = p_service_id
    and organization_id = p_organization_id
    and coalesce(active, true) = true
  limit 1;

  if v_service.id is null then
    raise exception 'Serviço inválido para esta organização';
  end if;

  if not exists (
    select 1
    from public.professionals pr
    where pr.id = p_professional_id
      and pr.organization_id = p_organization_id
      and coalesce(pr.is_active, true) = true
  ) then
    raise exception 'Profissional inválido para esta organização';
  end if;

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

  v_end_time := p_start_time + make_interval(mins => coalesce(v_service.duration_minutes, 30));

  if exists (
    select 1
    from public.appointments a
    where a.organization_id = p_organization_id
      and a.professional_id = p_professional_id
      and a.status in ('pending', 'scheduled', 'confirmed')
      and tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) then
    raise exception 'Horário indisponível';
  end if;

  insert into public.appointments (
    organization_id,
    customer_id,
    service_id,
    professional_id,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    p_organization_id,
    v_customer.id,
    p_service_id,
    p_professional_id,
    p_start_time,
    v_end_time,
    'pending',
    p_appointment_notes
  )
  returning * into v_appointment;

  insert into public.appointment_logs (
    appointment_id,
    customer_id,
    action,
    source,
    raw_message,
    push_name
  )
  values (
    v_appointment.id,
    v_customer.id,
    'public_request',
    'public_booking_page',
    null,
    p_name
  );

  return v_appointment;
end;
$$;


--
-- TOC entry 476 (class 1255 OID 63692)
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
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- TOC entry 655 (class 1255 OID 99757)
-- Name: sign_service_record(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sign_service_record(p_service_record_id uuid) RETURNS public.service_records
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_record public.service_records;
begin
  select *
    into v_record
  from public.service_records
  where id = p_service_record_id;

  if v_record.id is null then
    raise exception 'Prontuario nao encontrado';
  end if;

  if v_record.status <> 'finalized' then
    raise exception 'Somente prontuarios finalizados podem ser assinados';
  end if;

  if not exists (
    select 1
    from public.professionals pr
    where pr.id = v_record.professional_id
      and pr.user_id = auth.uid()
  ) then
    raise exception 'Sem permissao para assinar este prontuario';
  end if;

  update public.service_records
  set
    status = 'signed',
    signed_at = now(),
    signed_by_profile_id = auth.uid(),
    updated_at = now()
  where id = v_record.id
  returning * into v_record;

  return v_record;
end;
$$;


--
-- TOC entry 400 (class 1259 OID 48271)
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
-- TOC entry 404 (class 1259 OID 69372)
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
-- TOC entry 403 (class 1259 OID 60307)
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
-- TOC entry 399 (class 1259 OID 33500)
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
-- TOC entry 394 (class 1259 OID 33386)
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    organization_id uuid NOT NULL,
    open_hours_start time without time zone DEFAULT '08:00:00'::time without time zone,
    open_hours_end time without time zone DEFAULT '18:00:00'::time without time zone,
    days_of_week integer[] DEFAULT '{1,2,3,4,5}'::integer[],
    appointment_duration integer DEFAULT 30,
    msg_appointment_created text,
    msg_appointment_reminder text,
    msg_appointment_canceled text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    whatsapp_instance_name text,
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone,
    lunch_end time without time zone DEFAULT '13:00:00'::time without time zone
);


--
-- TOC entry 392 (class 1259 OID 33347)
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    niche text NOT NULL,
    whatsapp_instance_name text,
    evolution_api_key text,
    evolution_api_url text,
    whatsapp_status text DEFAULT 'disconnected'::text,
    stripe_customer_id text,
    subscription_status text DEFAULT 'active'::text,
    plan text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizations_niche_check CHECK ((niche = ANY (ARRAY['clinica'::text, 'barbearia'::text, 'salao'::text, 'generico'::text, 'advocacia'::text, 'oficina'::text, 'certificado'::text])))
);


--
-- TOC entry 401 (class 1259 OID 50532)
-- Name: professional_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professional_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    professional_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    break_start time without time zone,
    break_end time without time zone,
    CONSTRAINT professional_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- TOC entry 402 (class 1259 OID 50584)
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
-- TOC entry 393 (class 1259 OID 33363)
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
-- TOC entry 396 (class 1259 OID 33420)
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    price numeric(10,2) DEFAULT 0.00,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    color text DEFAULT '#3b82f6'::text
);


--
-- TOC entry 4057 (class 2606 OID 48279)
-- Name: appointment_logs appointment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4046 (class 2606 OID 33447)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 4048 (class 2606 OID 56919)
-- Name: appointments appointments_professional_overlap_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_overlap_idx EXCLUDE USING gist (professional_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE ((status <> 'canceled'::text));


--
-- TOC entry 4037 (class 2606 OID 58080)
-- Name: customers customers_document_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_document_unique UNIQUE (document);


--
-- TOC entry 4039 (class 2606 OID 33414)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 4067 (class 2606 OID 69382)
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 4065 (class 2606 OID 60317)
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- TOC entry 4053 (class 2606 OID 33512)
-- Name: invitations invitations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_code_key UNIQUE (code);


--
-- TOC entry 4055 (class 2606 OID 33510)
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4035 (class 2606 OID 33398)
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (organization_id);


--
-- TOC entry 4029 (class 2606 OID 33360)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4031 (class 2606 OID 33362)
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- TOC entry 4059 (class 2606 OID 50540)
-- Name: professional_availability professional_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_pkey PRIMARY KEY (id);


--
-- TOC entry 4061 (class 2606 OID 50542)
-- Name: professional_availability professional_availability_professional_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_day_of_week_key UNIQUE (professional_id, day_of_week);


--
-- TOC entry 4063 (class 2606 OID 50594)
-- Name: professionals professionals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_pkey PRIMARY KEY (id);


--
-- TOC entry 4033 (class 2606 OID 33374)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4051 (class 2606 OID 33479)
-- Name: service_records service_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_pkey PRIMARY KEY (id);


--
-- TOC entry 4044 (class 2606 OID 33431)
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- TOC entry 4049 (class 1259 OID 56920)
-- Name: idx_appointments_finance_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_finance_report ON public.appointments USING btree (organization_id, payment_status, payment_method) WHERE (status = 'completed'::text);


--
-- TOC entry 4040 (class 1259 OID 64829)
-- Name: idx_customers_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_not_deleted ON public.customers USING btree (id) WHERE (deleted_at IS NULL);


--
-- TOC entry 4041 (class 1259 OID 99744)
-- Name: uq_customers_org_document; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customers_org_document ON public.customers USING btree (organization_id, document_normalized) WHERE ((document_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- TOC entry 4042 (class 1259 OID 99745)
-- Name: uq_customers_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customers_org_phone ON public.customers USING btree (organization_id, phone_normalized) WHERE ((phone_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- TOC entry 4094 (class 2620 OID 33534)
-- Name: organizations on_organization_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();


--
-- TOC entry 4095 (class 2620 OID 99743)
-- Name: customers trg_normalize_customer_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_customer_fields BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_fields();


--
-- TOC entry 4085 (class 2606 OID 48280)
-- Name: appointment_logs appointment_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- TOC entry 4086 (class 2606 OID 48285)
-- Name: appointment_logs appointment_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4073 (class 2606 OID 33453)
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4074 (class 2606 OID 33448)
-- Name: appointments appointments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4075 (class 2606 OID 69340)
-- Name: appointments appointments_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- TOC entry 4076 (class 2606 OID 33458)
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- TOC entry 4071 (class 2606 OID 33415)
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4091 (class 2606 OID 69388)
-- Name: estimates estimates_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4092 (class 2606 OID 69383)
-- Name: estimates estimates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4093 (class 2606 OID 69393)
-- Name: estimates estimates_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id);


--
-- TOC entry 4090 (class 2606 OID 60318)
-- Name: expenses expenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4084 (class 2606 OID 33513)
-- Name: invitations invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4070 (class 2606 OID 33399)
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4087 (class 2606 OID 50610)
-- Name: professional_availability professional_availability_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;


--
-- TOC entry 4088 (class 2606 OID 50595)
-- Name: professionals professionals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4089 (class 2606 OID 50600)
-- Name: professionals professionals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4068 (class 2606 OID 33375)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4069 (class 2606 OID 33380)
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4077 (class 2606 OID 64857)
-- Name: service_records service_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- TOC entry 4078 (class 2606 OID 99732)
-- Name: service_records service_records_created_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4079 (class 2606 OID 33485)
-- Name: service_records service_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4080 (class 2606 OID 33480)
-- Name: service_records service_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4081 (class 2606 OID 99727)
-- Name: service_records service_records_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- TOC entry 4082 (class 2606 OID 33495)
-- Name: service_records service_records_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.profiles(id);


--
-- TOC entry 4083 (class 2606 OID 99737)
-- Name: service_records service_records_updated_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_updated_by_profile_id_fkey FOREIGN KEY (updated_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4072 (class 2606 OID 33432)
-- Name: services services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4279 (class 3256 OID 99747)
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
-- TOC entry 4269 (class 3256 OID 54019)
-- Name: professionals Admin total access or Professional self view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin total access or Professional self view" ON public.professionals FOR SELECT USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- TOC entry 4270 (class 3256 OID 54020)
-- Name: professionals Admin total update or Professional self update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin total update or Professional self update" ON public.professionals FOR UPDATE USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid()))) WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- TOC entry 4267 (class 3256 OID 33530)
-- Name: invitations Admins manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage invites" ON public.invitations USING (((organization_id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- TOC entry 4281 (class 3256 OID 99750)
-- Name: professional_availability Disponibilidade visível publicamente; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Disponibilidade visível publicamente" ON public.professional_availability FOR SELECT TO anon USING ((is_active = true));


--
-- TOC entry 4285 (class 3256 OID 99756)
-- Name: service_records Nao permitir delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Nao permitir delete" ON public.service_records FOR DELETE TO authenticated USING (false);


--
-- TOC entry 4257 (class 3256 OID 33520)
-- Name: organizations New users can create org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "New users can create org" ON public.organizations FOR INSERT WITH CHECK (true);


--
-- TOC entry 4264 (class 3256 OID 33527)
-- Name: appointments Org access appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access appointments" ON public.appointments USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4262 (class 3256 OID 33525)
-- Name: customers Org access customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access customers" ON public.customers USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4271 (class 3256 OID 69398)
-- Name: estimates Org access estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access estimates" ON public.estimates USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4265 (class 3256 OID 33528)
-- Name: service_records Org access records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access records" ON public.service_records USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4263 (class 3256 OID 33526)
-- Name: services Org access services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org access services" ON public.services USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4280 (class 3256 OID 99749)
-- Name: professional_availability Org can view all availabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org can view all availabilities" ON public.professional_availability FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.professionals pr
     JOIN public.profiles pf ON ((pf.organization_id = pr.organization_id)))
  WHERE ((pr.id = professional_availability.professional_id) AND (pf.id = auth.uid())))));


--
-- TOC entry 4282 (class 3256 OID 99753)
-- Name: service_records Org pode ver prontuarios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org pode ver prontuarios" ON public.service_records FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.organization_id = service_records.organization_id)))));


--
-- TOC entry 4274 (class 3256 OID 37013)
-- Name: service_records Professionals can update service_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Professionals can update service_records" ON public.service_records FOR UPDATE USING (((organization_id = ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (status = 'draft'::text))) WITH CHECK ((organization_id = ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- TOC entry 4273 (class 3256 OID 37011)
-- Name: service_records Professionals can view service_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Professionals can view service_records" ON public.service_records FOR SELECT USING ((organization_id = ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- TOC entry 4284 (class 3256 OID 99755)
-- Name: service_records Profissional edita proprio draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profissional edita proprio draft" ON public.service_records FOR UPDATE TO authenticated USING (((status = 'draft'::text) AND (professional_id IN ( SELECT pr.id
   FROM public.professionals pr
  WHERE (pr.user_id = auth.uid()))))) WITH CHECK ((status = 'draft'::text));


--
-- TOC entry 4283 (class 3256 OID 99754)
-- Name: service_records Profissional pode criar prontuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profissional pode criar prontuario" ON public.service_records FOR INSERT TO authenticated WITH CHECK ((professional_id IN ( SELECT pr.id
   FROM public.professionals pr
  WHERE (pr.user_id = auth.uid()))));


--
-- TOC entry 4277 (class 3256 OID 58043)
-- Name: professionals Public professionals are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public professionals are viewable by everyone" ON public.professionals FOR SELECT USING ((is_active = true));


--
-- TOC entry 4275 (class 3256 OID 58041)
-- Name: organizations Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.organizations FOR SELECT USING (true);


--
-- TOC entry 4266 (class 3256 OID 33529)
-- Name: invitations Public read invite by code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read invite by code" ON public.invitations FOR SELECT USING (true);


--
-- TOC entry 4278 (class 3256 OID 58072)
-- Name: appointments Public select appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public select appointments" ON public.appointments FOR SELECT TO anon USING ((status = 'pending'::text));


--
-- TOC entry 4276 (class 3256 OID 58042)
-- Name: services Public services are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public services are viewable by everyone" ON public.services FOR SELECT USING ((active = true));


--
-- TOC entry 4259 (class 3256 OID 33522)
-- Name: organization_settings Update org settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update org settings" ON public.organization_settings USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4261 (class 3256 OID 33524)
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- TOC entry 4256 (class 3256 OID 33519)
-- Name: organizations Users can update own org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own org" ON public.organizations FOR UPDATE USING ((id = public.get_user_org_id()));


--
-- TOC entry 4272 (class 3256 OID 33518)
-- Name: organizations Users can view own org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own org" ON public.organizations FOR SELECT USING ((id = public.get_user_org_id()));


--
-- TOC entry 4268 (class 3256 OID 51756)
-- Name: professionals Usuários veem profissionais da mesma org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem profissionais da mesma org" ON public.professionals FOR SELECT USING ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- TOC entry 4258 (class 3256 OID 33521)
-- Name: organization_settings View org settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View org settings" ON public.organization_settings FOR SELECT USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4260 (class 3256 OID 33523)
-- Name: profiles View profiles in same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View profiles in same org" ON public.profiles FOR SELECT USING (((organization_id = public.get_user_org_id()) OR (id = auth.uid())));


--
-- TOC entry 4252 (class 0 OID 48271)
-- Dependencies: 400
-- Name: appointment_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4249 (class 0 OID 33437)
-- Dependencies: 397
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4247 (class 0 OID 33404)
-- Dependencies: 395
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4255 (class 0 OID 69372)
-- Dependencies: 404
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4251 (class 0 OID 33500)
-- Dependencies: 399
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4246 (class 0 OID 33386)
-- Dependencies: 394
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4244 (class 0 OID 33347)
-- Dependencies: 392
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4253 (class 0 OID 50532)
-- Dependencies: 401
-- Name: professional_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4254 (class 0 OID 50584)
-- Dependencies: 402
-- Name: professionals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4245 (class 0 OID 33363)
-- Dependencies: 393
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4250 (class 0 OID 33468)
-- Dependencies: 398
-- Name: service_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4248 (class 0 OID 33420)
-- Dependencies: 396
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Completed on 2026-03-18 23:05:14

--
-- PostgreSQL database dump complete
--

\unrestrict C5Mi3rRk0C5HPe1ExwKFuZv1OlVbkpsM3exKS7Swvkvsll0V1CAMEv2ztfcvcTR

