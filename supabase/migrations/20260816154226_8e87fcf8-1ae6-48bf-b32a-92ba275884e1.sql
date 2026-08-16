-- Link a bench (judge) login to a judge record
ALTER TABLE public.judges ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS judges_user_id_idx ON public.judges(user_id);

CREATE OR REPLACE FUNCTION public.current_judge_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.judges WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_registry_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'registrar')
$$;

-- JUDGES: staff see all; a judge sees only their own record
DROP POLICY IF EXISTS "Staff view judges" ON public.judges;
CREATE POLICY "Registry staff and own bench view judges" ON public.judges
FOR SELECT TO authenticated
USING (public.is_registry_staff() OR user_id = auth.uid());

-- SCHEDULES: staff see all; a judge sees only their own listings
DROP POLICY IF EXISTS "Staff view schedules" ON public.schedules;
CREATE POLICY "Registry staff and own bench view schedules" ON public.schedules
FOR SELECT TO authenticated
USING (public.is_registry_staff() OR judge_id = public.current_judge_id());

-- CASES: staff see all; a judge sees only cases listed before them
DROP POLICY IF EXISTS "Staff view cases" ON public.cases;
CREATE POLICY "Registry staff and own bench view cases" ON public.cases
FOR SELECT TO authenticated
USING (
  public.is_registry_staff() OR EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.case_id = cases.id AND s.judge_id = public.current_judge_id()
  )
);

-- COURTROOMS: staff see all; a judge sees only courtrooms they are listed in
DROP POLICY IF EXISTS "Staff view courtrooms" ON public.courtrooms;
CREATE POLICY "Registry staff and own bench view courtrooms" ON public.courtrooms
FOR SELECT TO authenticated
USING (
  public.is_registry_staff() OR EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.courtroom_id = courtrooms.id AND s.judge_id = public.current_judge_id()
  )
);

-- AVAILABILITY: staff see all; a judge sees only their own availability
DROP POLICY IF EXISTS "Staff view availability" ON public.availability;
CREATE POLICY "Registry staff and own bench view availability" ON public.availability
FOR SELECT TO authenticated
USING (
  public.is_registry_staff()
  OR (entity_type = 'judge' AND entity_id = public.current_judge_id())
);

-- ADJOURNMENTS: staff see all; a judge sees only their own cases' adjournments
DROP POLICY IF EXISTS "Staff view adjournments" ON public.adjournments;
CREATE POLICY "Registry staff and own bench view adjournments" ON public.adjournments
FOR SELECT TO authenticated
USING (
  public.is_registry_staff() OR EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.case_id = adjournments.case_id AND s.judge_id = public.current_judge_id()
  )
);

-- AI RECOMMENDATIONS: staff see all; a judge may read the reasoning for their own listings
DROP POLICY IF EXISTS "Staff view recommendations" ON public.ai_recommendations;
CREATE POLICY "Registry staff and own bench view recommendations" ON public.ai_recommendations
FOR SELECT TO authenticated
USING (
  public.is_registry_staff() OR EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = ai_recommendations.schedule_id AND s.judge_id = public.current_judge_id()
  )
);

-- NOTIFICATIONS LOG: registry staff only
DROP POLICY IF EXISTS "Staff view notification log" ON public.notifications_log;
CREATE POLICY "Registry staff view notification log" ON public.notifications_log
FOR SELECT TO authenticated
USING (public.is_registry_staff());