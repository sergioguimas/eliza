BEGIN;

-- A document must be unique inside a tenant, not globally. The normalized
-- partial index is the canonical rule, so the raw/global variants are removed.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_document_unique;

DROP INDEX IF EXISTS public.customers_unique_document_per_org;

-- Keep database constraints aligned with statuses used by the application and
-- by the service-record functions.
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

ALTER TABLE public.service_records
  DROP CONSTRAINT IF EXISTS service_records_status_check;

UPDATE public.service_records
SET status = 'finalized'
WHERE status = 'final';

ALTER TABLE public.service_records
  ADD CONSTRAINT service_records_status_check
    CHECK (status IN ('draft', 'finalized', 'signed'));

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

-- Consolidate overlapping permissive policies. The previous FOR ALL policy
-- made the delete-deny policy ineffective and rendered the more specific
-- professional policies redundant.
DROP POLICY IF EXISTS "Org access records"
  ON public.service_records;
DROP POLICY IF EXISTS "Professionals can view service_records"
  ON public.service_records;
DROP POLICY IF EXISTS "Professionals can update service_records"
  ON public.service_records;
DROP POLICY IF EXISTS "Org pode ver prontuarios"
  ON public.service_records;
DROP POLICY IF EXISTS "Profissional pode criar prontuario"
  ON public.service_records;
DROP POLICY IF EXISTS "Profissional edita proprio draft"
  ON public.service_records;
DROP POLICY IF EXISTS "Nao permitir delete"
  ON public.service_records;

CREATE POLICY "Org access records select"
ON public.service_records
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_org_id());

CREATE POLICY "Org access records insert"
ON public.service_records
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Org access records update drafts"
ON public.service_records
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_org_id()
  AND status = 'draft'
)
WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Org access records delete drafts"
ON public.service_records
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_org_id()
  AND status = 'draft'
);

NOTIFY pgrst, 'reload schema';

COMMIT;
