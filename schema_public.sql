--
-- PostgreSQL database dump
--

\restrict V5lXPQFcYYcSeDPNrSaFSlDcxyF5F3yuvYpGJu2VYu37angcOPGfrDjtararIp3

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-08-15 09:06:08

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
-- TOC entry 138 (class 2615 OID 32071)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 397 (class 1259 OID 33468)
-- Name: service_records; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT service_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'signed'::text])))
);


ALTER TABLE public.service_records OWNER TO postgres;

--
-- TOC entry 692 (class 1255 OID 99758)
-- Name: finalize_service_record(uuid); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.finalize_service_record(p_service_record_id uuid) OWNER TO postgres;

--
-- TOC entry 394 (class 1259 OID 33404)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 443 (class 1255 OID 99746)
-- Name: find_or_create_public_customer(uuid, text, text, text, text, date, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text) OWNER TO postgres;

--
-- TOC entry 571 (class 1255 OID 33385)
-- Name: get_user_org_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION public.get_user_org_id() OWNER TO postgres;

--
-- TOC entry 526 (class 1255 OID 33533)
-- Name: handle_new_organization(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_professional_id uuid;
BEGIN
  -- 1. Garante as configurações da organização
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 2. Garante um profissional padrão para a organização
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


ALTER FUNCTION public.handle_new_organization() OWNER TO postgres;

--
-- TOC entry 651 (class 1255 OID 33531)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_full_name text;
  v_role text;
  v_organization_id uuid;
  v_organization_id_text text;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    new.email
  );

  v_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', ''),
    'staff'
  );

  if v_role not in ('owner', 'admin', 'professional', 'staff') then
    v_role := 'staff';
  end if;

  v_organization_id_text := coalesce(
    nullif(new.raw_user_meta_data->>'organization_id', ''),
    nullif(new.raw_user_meta_data->>'organizationId', '')
  );

  -- Só tenta converter se parecer UUID válido.
  if v_organization_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_organization_id := v_organization_id_text::uuid;
  else
    v_organization_id := null;
  end if;

  -- Evita violar FK caso a organização ainda não exista.
  if v_organization_id is not null
     and not exists (
       select 1
       from public.organizations o
       where o.id = v_organization_id
     ) then
    v_organization_id := null;
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    organization_id
  )
  values (
    new.id,
    v_full_name,
    new.email,
    v_role,
    v_organization_id
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    organization_id = excluded.organization_id,
    updated_at = now();

  return new;
end;
$_$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- TOC entry 697 (class 1255 OID 99742)
-- Name: normalize_customer_fields(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.normalize_customer_fields() OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 33437)
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.appointments OWNER TO postgres;

--
-- TOC entry 4381 (class 0 OID 0)
-- Dependencies: 396
-- Name: COLUMN appointments.payment_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments.payment_method IS 'Método de pagamento utilizado pelo cliente.';


--
-- TOC entry 4382 (class 0 OID 0)
-- Dependencies: 396
-- Name: COLUMN appointments.payment_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments.payment_status IS 'Status do pagamento para controle interno do dashboard.';


--
-- TOC entry 606 (class 1255 OID 99751)
-- Name: request_public_appointment(uuid, uuid, uuid, timestamp with time zone, text, text, text, text, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
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

  select s.*
    into v_service
  from public.services s
  where s.id = p_service_id
    and s.organization_id = p_organization_id
    and coalesce(s.is_active, true) = true
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


ALTER FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text, p_appointment_notes text) OWNER TO postgres;

--
-- TOC entry 487 (class 1255 OID 63692)
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- TOC entry 663 (class 1255 OID 99757)
-- Name: sign_service_record(uuid); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.sign_service_record(p_service_record_id uuid) OWNER TO postgres;

--
-- TOC entry 473 (class 1255 OID 121891)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 399 (class 1259 OID 48271)
-- Name: appointment_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.appointment_logs OWNER TO postgres;

--
-- TOC entry 409 (class 1259 OID 126839)
-- Name: demo_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demo_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    niche text,
    action text NOT NULL,
    step_number integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT demo_interactions_action_check CHECK ((action = ANY (ARRAY['tour_started'::text, 'step_completed'::text, 'appointment_created'::text, 'appointment_completed'::text, 'return_scheduled'::text, 'record_added'::text, 'timeline_viewed'::text, 'whatsapp_opt_in'::text, 'whatsapp_sent'::text, 'tour_completed'::text, 'tour_abandoned'::text, 'lead_captured'::text]))),
    CONSTRAINT demo_interactions_step_number_check CHECK (((step_number IS NULL) OR ((step_number >= 1) AND (step_number <= 12))))
);


ALTER TABLE public.demo_interactions OWNER TO postgres;

--
-- TOC entry 411 (class 1259 OID 126880)
-- Name: demo_leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demo_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    niche text,
    name text NOT NULL,
    contact text NOT NULL,
    source text DEFAULT 'demo_tour'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.demo_leads OWNER TO postgres;

--
-- TOC entry 412 (class 1259 OID 126897)
-- Name: demo_rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demo_rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.demo_rate_limits OWNER TO postgres;

--
-- TOC entry 410 (class 1259 OID 126858)
-- Name: demo_timeline_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demo_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    appointment_id uuid,
    event_type text NOT NULL,
    simulated_time timestamp with time zone NOT NULL,
    message_text text,
    response_text text,
    delivered_for_real boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT demo_timeline_events_event_type_check CHECK ((event_type = ANY (ARRAY['appointment_created'::text, 'reminder_1h'::text, 'client_confirmed'::text, 'appointment_time'::text])))
);


ALTER TABLE public.demo_timeline_events OWNER TO postgres;

--
-- TOC entry 403 (class 1259 OID 69372)
-- Name: estimates; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.estimates OWNER TO postgres;

--
-- TOC entry 402 (class 1259 OID 60307)
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.expenses OWNER TO postgres;

--
-- TOC entry 398 (class 1259 OID 33500)
-- Name: invitations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.invitations OWNER TO postgres;

--
-- TOC entry 407 (class 1259 OID 105356)
-- Name: notification_dispatches; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notification_dispatches OWNER TO postgres;

--
-- TOC entry 393 (class 1259 OID 33386)
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
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
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone,
    lunch_end time without time zone DEFAULT '13:00:00'::time without time zone,
    msg_doctor_daily_summary text,
    msg_appointment_pending text
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- TOC entry 391 (class 1259 OID 33347)
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    niche text NOT NULL,
    whatsapp_instance_name text,
    whatsapp_status text DEFAULT 'disconnected'::text,
    stripe_customer_id text,
    subscription_status text DEFAULT 'active'::text,
    plan text DEFAULT 'free'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    is_demo boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT organizations_demo_requires_expiry CHECK (((is_demo = false) OR (expires_at IS NOT NULL))),
    CONSTRAINT organizations_niche_check CHECK ((niche = ANY (ARRAY['clinica'::text, 'psicologia'::text, 'barbearia'::text, 'salao'::text, 'generico'::text, 'advocacia'::text, 'oficina'::text, 'certificado'::text, 'tatuador'::text])))
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- TOC entry 400 (class 1259 OID 50532)
-- Name: professional_availability; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.professional_availability OWNER TO postgres;

--
-- TOC entry 401 (class 1259 OID 50584)
-- Name: professionals; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.professionals OWNER TO postgres;

--
-- TOC entry 392 (class 1259 OID 33363)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 395 (class 1259 OID 33420)
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    duration_minutes integer DEFAULT 30 NOT NULL,
    price numeric(10,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    color text DEFAULT '#3b82f6'::text
);


ALTER TABLE public.services OWNER TO postgres;

--
-- TOC entry 4104 (class 2606 OID 48279)
-- Name: appointment_logs appointment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4092 (class 2606 OID 33447)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 4094 (class 2606 OID 121535)
-- Name: appointments appointments_professional_overlap_idx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_overlap_idx EXCLUDE USING gist (professional_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'arrived'::text])));


--
-- TOC entry 4085 (class 2606 OID 33414)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 2606 OID 126850)
-- Name: demo_interactions demo_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_interactions
    ADD CONSTRAINT demo_interactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4127 (class 2606 OID 126890)
-- Name: demo_leads demo_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_leads
    ADD CONSTRAINT demo_leads_pkey PRIMARY KEY (id);


--
-- TOC entry 4130 (class 2606 OID 126906)
-- Name: demo_rate_limits demo_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_rate_limits
    ADD CONSTRAINT demo_rate_limits_pkey PRIMARY KEY (key);


--
-- TOC entry 4124 (class 2606 OID 126868)
-- Name: demo_timeline_events demo_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_timeline_events
    ADD CONSTRAINT demo_timeline_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4114 (class 2606 OID 69382)
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 4112 (class 2606 OID 60317)
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- TOC entry 4100 (class 2606 OID 33512)
-- Name: invitations invitations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_code_key UNIQUE (code);


--
-- TOC entry 4102 (class 2606 OID 33510)
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- TOC entry 4116 (class 2606 OID 105365)
-- Name: notification_dispatches notification_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_pkey PRIMARY KEY (id);


--
-- TOC entry 4082 (class 2606 OID 33398)
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (organization_id);


--
-- TOC entry 4076 (class 2606 OID 33360)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4078 (class 2606 OID 33362)
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- TOC entry 4106 (class 2606 OID 50540)
-- Name: professional_availability professional_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_pkey PRIMARY KEY (id);


--
-- TOC entry 4108 (class 2606 OID 50542)
-- Name: professional_availability professional_availability_professional_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_day_of_week_key UNIQUE (professional_id, day_of_week);


--
-- TOC entry 4110 (class 2606 OID 50594)
-- Name: professionals professionals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_pkey PRIMARY KEY (id);


--
-- TOC entry 4080 (class 2606 OID 33374)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4098 (class 2606 OID 33479)
-- Name: service_records service_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_pkey PRIMARY KEY (id);


--
-- TOC entry 4090 (class 2606 OID 33431)
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- TOC entry 4083 (class 1259 OID 121443)
-- Name: customers_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customers_phone_idx ON public.customers USING btree (phone);


--
-- TOC entry 4095 (class 1259 OID 56920)
-- Name: idx_appointments_finance_report; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_finance_report ON public.appointments USING btree (organization_id, payment_status, payment_method) WHERE (status = 'completed'::text);


--
-- TOC entry 4086 (class 1259 OID 64829)
-- Name: idx_customers_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_not_deleted ON public.customers USING btree (id) WHERE (deleted_at IS NULL);


--
-- TOC entry 4121 (class 1259 OID 126857)
-- Name: idx_demo_interactions_funnel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demo_interactions_funnel ON public.demo_interactions USING btree (created_at DESC, niche, action);


--
-- TOC entry 4122 (class 1259 OID 126856)
-- Name: idx_demo_interactions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demo_interactions_org ON public.demo_interactions USING btree (organization_id);


--
-- TOC entry 4128 (class 1259 OID 126896)
-- Name: idx_demo_leads_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demo_leads_created ON public.demo_leads USING btree (created_at DESC);


--
-- TOC entry 4131 (class 1259 OID 126907)
-- Name: idx_demo_rate_limits_window; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demo_rate_limits_window ON public.demo_rate_limits USING btree (window_start);


--
-- TOC entry 4125 (class 1259 OID 126879)
-- Name: idx_demo_timeline_events_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demo_timeline_events_org ON public.demo_timeline_events USING btree (organization_id, simulated_time);


--
-- TOC entry 4074 (class 1259 OID 126838)
-- Name: idx_organizations_demo_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_demo_expiry ON public.organizations USING btree (expires_at) WHERE (is_demo = true);


--
-- TOC entry 4096 (class 1259 OID 121545)
-- Name: idx_reminder_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reminder_sent_at ON public.appointments USING btree (reminder_sent_at);


--
-- TOC entry 4117 (class 1259 OID 105386)
-- Name: notification_dispatches_unique_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_dispatches_unique_doctor ON public.notification_dispatches USING btree (kind, professional_id, dispatch_date) WHERE (professional_id IS NOT NULL);


--
-- TOC entry 4118 (class 1259 OID 105387)
-- Name: notification_dispatches_unique_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_dispatches_unique_patient ON public.notification_dispatches USING btree (kind, appointment_id, dispatch_date) WHERE (appointment_id IS NOT NULL);


--
-- TOC entry 4087 (class 1259 OID 99744)
-- Name: uq_customers_org_document; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_customers_org_document ON public.customers USING btree (organization_id, document_normalized) WHERE ((document_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- TOC entry 4088 (class 1259 OID 99745)
-- Name: uq_customers_org_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_customers_org_phone ON public.customers USING btree (organization_id, phone_normalized) WHERE ((phone_normalized IS NOT NULL) AND (deleted_at IS NULL));


--
-- TOC entry 4166 (class 2620 OID 33534)
-- Name: organizations on_organization_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_organization_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();


--
-- TOC entry 4167 (class 2620 OID 99743)
-- Name: customers trg_normalize_customer_fields; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_normalize_customer_fields BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_fields();


--
-- TOC entry 4168 (class 2620 OID 121892)
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4149 (class 2606 OID 48280)
-- Name: appointment_logs appointment_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- TOC entry 4150 (class 2606 OID 48285)
-- Name: appointment_logs appointment_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4137 (class 2606 OID 33453)
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4138 (class 2606 OID 33448)
-- Name: appointments appointments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4139 (class 2606 OID 69340)
-- Name: appointments appointments_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- TOC entry 4140 (class 2606 OID 33458)
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- TOC entry 4135 (class 2606 OID 33415)
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4162 (class 2606 OID 126851)
-- Name: demo_interactions demo_interactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_interactions
    ADD CONSTRAINT demo_interactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- TOC entry 4165 (class 2606 OID 126891)
-- Name: demo_leads demo_leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_leads
    ADD CONSTRAINT demo_leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- TOC entry 4163 (class 2606 OID 126874)
-- Name: demo_timeline_events demo_timeline_events_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_timeline_events
    ADD CONSTRAINT demo_timeline_events_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- TOC entry 4164 (class 2606 OID 126869)
-- Name: demo_timeline_events demo_timeline_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demo_timeline_events
    ADD CONSTRAINT demo_timeline_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4155 (class 2606 OID 69388)
-- Name: estimates estimates_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4156 (class 2606 OID 69383)
-- Name: estimates estimates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4157 (class 2606 OID 69393)
-- Name: estimates estimates_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id);


--
-- TOC entry 4154 (class 2606 OID 60318)
-- Name: expenses expenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4148 (class 2606 OID 33513)
-- Name: invitations invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4158 (class 2606 OID 105371)
-- Name: notification_dispatches notification_dispatches_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- TOC entry 4159 (class 2606 OID 105381)
-- Name: notification_dispatches notification_dispatches_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 4160 (class 2606 OID 105366)
-- Name: notification_dispatches notification_dispatches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4161 (class 2606 OID 105376)
-- Name: notification_dispatches notification_dispatches_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_dispatches
    ADD CONSTRAINT notification_dispatches_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;


--
-- TOC entry 4134 (class 2606 OID 33399)
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4151 (class 2606 OID 50610)
-- Name: professional_availability professional_availability_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professional_availability
    ADD CONSTRAINT professional_availability_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;


--
-- TOC entry 4152 (class 2606 OID 50595)
-- Name: professionals professionals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4153 (class 2606 OID 50600)
-- Name: professionals professionals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professionals
    ADD CONSTRAINT professionals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4132 (class 2606 OID 33375)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4133 (class 2606 OID 33380)
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4141 (class 2606 OID 64857)
-- Name: service_records service_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- TOC entry 4142 (class 2606 OID 99732)
-- Name: service_records service_records_created_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4143 (class 2606 OID 33485)
-- Name: service_records service_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4144 (class 2606 OID 33480)
-- Name: service_records service_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4145 (class 2606 OID 99727)
-- Name: service_records service_records_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;


--
-- TOC entry 4146 (class 2606 OID 33495)
-- Name: service_records service_records_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.profiles(id);


--
-- TOC entry 4147 (class 2606 OID 99737)
-- Name: service_records service_records_updated_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_records
    ADD CONSTRAINT service_records_updated_by_profile_id_fkey FOREIGN KEY (updated_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- TOC entry 4136 (class 2606 OID 33432)
-- Name: services services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 4351 (class 3256 OID 99747)
-- Name: professional_availability Admin manage all or Professional manage own availability; Type: POLICY; Schema: public; Owner: postgres
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
-- TOC entry 4344 (class 3256 OID 54019)
-- Name: professionals Admin total access or Professional self view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin total access or Professional self view" ON public.professionals FOR SELECT USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- TOC entry 4345 (class 3256 OID 54020)
-- Name: professionals Admin total update or Professional self update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin total update or Professional self update" ON public.professionals FOR UPDATE USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid()))) WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'owner'::text) OR (user_id = auth.uid())));


--
-- TOC entry 4342 (class 3256 OID 33530)
-- Name: invitations Admins manage invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage invites" ON public.invitations USING (((organization_id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- TOC entry 4359 (class 3256 OID 126835)
-- Name: organizations Authenticated users can create org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);


--
-- TOC entry 4353 (class 3256 OID 99750)
-- Name: professional_availability Disponibilidade visível publicamente; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Disponibilidade visível publicamente" ON public.professional_availability FOR SELECT TO anon USING ((is_active = true));


--
-- TOC entry 4341 (class 3256 OID 33527)
-- Name: appointments Org access appointments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access appointments" ON public.appointments USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4339 (class 3256 OID 33525)
-- Name: customers Org access customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access customers" ON public.customers USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4360 (class 3256 OID 126908)
-- Name: demo_interactions Org access demo interactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access demo interactions" ON public.demo_interactions USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4361 (class 3256 OID 126909)
-- Name: demo_timeline_events Org access demo timeline; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access demo timeline" ON public.demo_timeline_events USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4346 (class 3256 OID 69398)
-- Name: estimates Org access estimates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access estimates" ON public.estimates USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4362 (class 3256 OID 126979)
-- Name: expenses Org access expenses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access expenses" ON public.expenses TO authenticated USING ((organization_id = public.get_user_org_id())) WITH CHECK ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4357 (class 3256 OID 122477)
-- Name: service_records Org access records delete drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access records delete drafts" ON public.service_records FOR DELETE TO authenticated USING (((organization_id = public.get_user_org_id()) AND (status = 'draft'::text)));


--
-- TOC entry 4355 (class 3256 OID 122475)
-- Name: service_records Org access records insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access records insert" ON public.service_records FOR INSERT TO authenticated WITH CHECK ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4354 (class 3256 OID 122474)
-- Name: service_records Org access records select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access records select" ON public.service_records FOR SELECT TO authenticated USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4356 (class 3256 OID 122476)
-- Name: service_records Org access records update drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access records update drafts" ON public.service_records FOR UPDATE TO authenticated USING (((organization_id = public.get_user_org_id()) AND (status = 'draft'::text))) WITH CHECK ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4340 (class 3256 OID 33526)
-- Name: services Org access services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org access services" ON public.services USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4352 (class 3256 OID 99749)
-- Name: professional_availability Org can view all availabilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org can view all availabilities" ON public.professional_availability FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.professionals pr
     JOIN public.profiles pf ON ((pf.organization_id = pr.organization_id)))
  WHERE ((pr.id = professional_availability.professional_id) AND (pf.id = auth.uid())))));


--
-- TOC entry 4358 (class 3256 OID 126833)
-- Name: organizations Owners and admins update own org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins update own org" ON public.organizations FOR UPDATE TO authenticated USING (((id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- TOC entry 4350 (class 3256 OID 58043)
-- Name: professionals Public professionals are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public professionals are viewable by everyone" ON public.professionals FOR SELECT USING ((is_active = true));


--
-- TOC entry 4348 (class 3256 OID 58041)
-- Name: organizations Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.organizations FOR SELECT USING (true);


--
-- TOC entry 4349 (class 3256 OID 58042)
-- Name: services Public services are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public services are viewable by everyone" ON public.services FOR SELECT USING ((is_active = true));


--
-- TOC entry 4336 (class 3256 OID 33522)
-- Name: organization_settings Update org settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Update org settings" ON public.organization_settings USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4338 (class 3256 OID 33524)
-- Name: profiles Update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid()));


--
-- TOC entry 4347 (class 3256 OID 33518)
-- Name: organizations Users can view own org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org" ON public.organizations FOR SELECT USING ((id = public.get_user_org_id()));


--
-- TOC entry 4343 (class 3256 OID 51756)
-- Name: professionals Usuários veem profissionais da mesma org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuários veem profissionais da mesma org" ON public.professionals FOR SELECT USING ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- TOC entry 4335 (class 3256 OID 33521)
-- Name: organization_settings View org settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View org settings" ON public.organization_settings FOR SELECT USING ((organization_id = public.get_user_org_id()));


--
-- TOC entry 4337 (class 3256 OID 33523)
-- Name: profiles View profiles in same org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "View profiles in same org" ON public.profiles FOR SELECT USING (((organization_id = public.get_user_org_id()) OR (id = auth.uid())));


--
-- TOC entry 4325 (class 0 OID 48271)
-- Dependencies: 399
-- Name: appointment_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.appointment_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4322 (class 0 OID 33437)
-- Dependencies: 396
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4320 (class 0 OID 33404)
-- Dependencies: 394
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4331 (class 0 OID 126839)
-- Dependencies: 409
-- Name: demo_interactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.demo_interactions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4333 (class 0 OID 126880)
-- Dependencies: 411
-- Name: demo_leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4334 (class 0 OID 126897)
-- Dependencies: 412
-- Name: demo_rate_limits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4332 (class 0 OID 126858)
-- Dependencies: 410
-- Name: demo_timeline_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.demo_timeline_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4329 (class 0 OID 69372)
-- Dependencies: 403
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4328 (class 0 OID 60307)
-- Dependencies: 402
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4324 (class 0 OID 33500)
-- Dependencies: 398
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4330 (class 0 OID 105356)
-- Dependencies: 407
-- Name: notification_dispatches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_dispatches ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4319 (class 0 OID 33386)
-- Dependencies: 393
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4317 (class 0 OID 33347)
-- Dependencies: 391
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4326 (class 0 OID 50532)
-- Dependencies: 400
-- Name: professional_availability; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4327 (class 0 OID 50584)
-- Dependencies: 401
-- Name: professionals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4318 (class 0 OID 33363)
-- Dependencies: 392
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4323 (class 0 OID 33468)
-- Dependencies: 397
-- Name: service_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4321 (class 0 OID 33420)
-- Dependencies: 395
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4372 (class 0 OID 0)
-- Dependencies: 138
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4373 (class 0 OID 0)
-- Dependencies: 397
-- Name: TABLE service_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.service_records TO anon;
GRANT ALL ON TABLE public.service_records TO authenticated;
GRANT ALL ON TABLE public.service_records TO service_role;


--
-- TOC entry 4374 (class 0 OID 0)
-- Dependencies: 692
-- Name: FUNCTION finalize_service_record(p_service_record_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.finalize_service_record(p_service_record_id uuid) TO anon;
GRANT ALL ON FUNCTION public.finalize_service_record(p_service_record_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.finalize_service_record(p_service_record_id uuid) TO service_role;


--
-- TOC entry 4375 (class 0 OID 0)
-- Dependencies: 394
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- TOC entry 4376 (class 0 OID 0)
-- Dependencies: 443
-- Name: FUNCTION find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.find_or_create_public_customer(p_organization_id uuid, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text) TO service_role;


--
-- TOC entry 4377 (class 0 OID 0)
-- Dependencies: 571
-- Name: FUNCTION get_user_org_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_org_id() TO anon;
GRANT ALL ON FUNCTION public.get_user_org_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_org_id() TO service_role;


--
-- TOC entry 4378 (class 0 OID 0)
-- Dependencies: 526
-- Name: FUNCTION handle_new_organization(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_organization() TO anon;
GRANT ALL ON FUNCTION public.handle_new_organization() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_organization() TO service_role;


--
-- TOC entry 4379 (class 0 OID 0)
-- Dependencies: 651
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- TOC entry 4380 (class 0 OID 0)
-- Dependencies: 697
-- Name: FUNCTION normalize_customer_fields(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_customer_fields() TO anon;
GRANT ALL ON FUNCTION public.normalize_customer_fields() TO authenticated;
GRANT ALL ON FUNCTION public.normalize_customer_fields() TO service_role;


--
-- TOC entry 4383 (class 0 OID 0)
-- Dependencies: 396
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.appointments TO authenticated;
GRANT ALL ON TABLE public.appointments TO service_role;


--
-- TOC entry 4384 (class 0 OID 0)
-- Dependencies: 606
-- Name: FUNCTION request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text, p_appointment_notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text, p_appointment_notes text) TO anon;
GRANT ALL ON FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text, p_appointment_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.request_public_appointment(p_organization_id uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone, p_name text, p_phone text, p_document text, p_email text, p_birth_date date, p_gender text, p_address text, p_notes text, p_appointment_notes text) TO service_role;


--
-- TOC entry 4385 (class 0 OID 0)
-- Dependencies: 487
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- TOC entry 4386 (class 0 OID 0)
-- Dependencies: 663
-- Name: FUNCTION sign_service_record(p_service_record_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sign_service_record(p_service_record_id uuid) TO anon;
GRANT ALL ON FUNCTION public.sign_service_record(p_service_record_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.sign_service_record(p_service_record_id uuid) TO service_role;


--
-- TOC entry 4387 (class 0 OID 0)
-- Dependencies: 473
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- TOC entry 4388 (class 0 OID 0)
-- Dependencies: 399
-- Name: TABLE appointment_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.appointment_logs TO anon;
GRANT ALL ON TABLE public.appointment_logs TO authenticated;
GRANT ALL ON TABLE public.appointment_logs TO service_role;


--
-- TOC entry 4389 (class 0 OID 0)
-- Dependencies: 409
-- Name: TABLE demo_interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.demo_interactions TO anon;
GRANT ALL ON TABLE public.demo_interactions TO authenticated;
GRANT ALL ON TABLE public.demo_interactions TO service_role;


--
-- TOC entry 4390 (class 0 OID 0)
-- Dependencies: 411
-- Name: TABLE demo_leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.demo_leads TO anon;
GRANT ALL ON TABLE public.demo_leads TO authenticated;
GRANT ALL ON TABLE public.demo_leads TO service_role;


--
-- TOC entry 4391 (class 0 OID 0)
-- Dependencies: 412
-- Name: TABLE demo_rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.demo_rate_limits TO anon;
GRANT ALL ON TABLE public.demo_rate_limits TO authenticated;
GRANT ALL ON TABLE public.demo_rate_limits TO service_role;


--
-- TOC entry 4392 (class 0 OID 0)
-- Dependencies: 410
-- Name: TABLE demo_timeline_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.demo_timeline_events TO anon;
GRANT ALL ON TABLE public.demo_timeline_events TO authenticated;
GRANT ALL ON TABLE public.demo_timeline_events TO service_role;


--
-- TOC entry 4393 (class 0 OID 0)
-- Dependencies: 403
-- Name: TABLE estimates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.estimates TO anon;
GRANT ALL ON TABLE public.estimates TO authenticated;
GRANT ALL ON TABLE public.estimates TO service_role;


--
-- TOC entry 4394 (class 0 OID 0)
-- Dependencies: 402
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- TOC entry 4395 (class 0 OID 0)
-- Dependencies: 398
-- Name: TABLE invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invitations TO authenticated;
GRANT ALL ON TABLE public.invitations TO service_role;


--
-- TOC entry 4396 (class 0 OID 0)
-- Dependencies: 407
-- Name: TABLE notification_dispatches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_dispatches TO anon;
GRANT ALL ON TABLE public.notification_dispatches TO authenticated;
GRANT ALL ON TABLE public.notification_dispatches TO service_role;


--
-- TOC entry 4397 (class 0 OID 0)
-- Dependencies: 393
-- Name: TABLE organization_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_settings TO anon;
GRANT ALL ON TABLE public.organization_settings TO authenticated;
GRANT ALL ON TABLE public.organization_settings TO service_role;


--
-- TOC entry 4398 (class 0 OID 0)
-- Dependencies: 391
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO service_role;


--
-- TOC entry 4399 (class 0 OID 0)
-- Dependencies: 391 4398
-- Name: COLUMN organizations.id; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(id) ON TABLE public.organizations TO anon;
GRANT SELECT(id) ON TABLE public.organizations TO authenticated;


--
-- TOC entry 4400 (class 0 OID 0)
-- Dependencies: 391 4398
-- Name: COLUMN organizations.name; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(name),INSERT(name),UPDATE(name) ON TABLE public.organizations TO authenticated;
GRANT SELECT(name) ON TABLE public.organizations TO anon;


--
-- TOC entry 4401 (class 0 OID 0)
-- Dependencies: 391 4398
-- Name: COLUMN organizations.slug; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(slug),INSERT(slug) ON TABLE public.organizations TO authenticated;
GRANT SELECT(slug) ON TABLE public.organizations TO anon;


--
-- TOC entry 4402 (class 0 OID 0)
-- Dependencies: 391 4398
-- Name: COLUMN organizations.niche; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(niche),INSERT(niche),UPDATE(niche) ON TABLE public.organizations TO authenticated;
GRANT SELECT(niche) ON TABLE public.organizations TO anon;


--
-- TOC entry 4403 (class 0 OID 0)
-- Dependencies: 391 4398
-- Name: COLUMN organizations.created_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(created_at) ON TABLE public.organizations TO anon;


--
-- TOC entry 4404 (class 0 OID 0)
-- Dependencies: 400
-- Name: TABLE professional_availability; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.professional_availability TO anon;
GRANT ALL ON TABLE public.professional_availability TO authenticated;
GRANT ALL ON TABLE public.professional_availability TO service_role;


--
-- TOC entry 4405 (class 0 OID 0)
-- Dependencies: 401
-- Name: TABLE professionals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.professionals TO anon;
GRANT ALL ON TABLE public.professionals TO authenticated;
GRANT ALL ON TABLE public.professionals TO service_role;


--
-- TOC entry 4406 (class 0 OID 0)
-- Dependencies: 392
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- TOC entry 4407 (class 0 OID 0)
-- Dependencies: 395
-- Name: TABLE services; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;


--
-- TOC entry 2814 (class 826 OID 32074)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2813 (class 826 OID 32073)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2812 (class 826 OID 32072)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-08-15 09:06:28

--
-- PostgreSQL database dump complete
--

\unrestrict V5lXPQFcYYcSeDPNrSaFSlDcxyF5F3yuvYpGJu2VYu37angcOPGfrDjtararIp3

