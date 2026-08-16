-- Permissions on staff profiles (the "users" table for this app)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Admins manage profiles
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enums
CREATE TYPE public.case_status AS ENUM ('filed','scheduled','in_progress','adjourned','disposed');
CREATE TYPE public.entity_type AS ENUM ('judge','courtroom');
CREATE TYPE public.availability_status AS ENUM ('available','unavailable');
CREATE TYPE public.schedule_status AS ENUM ('proposed','confirmed','completed','cancelled');
CREATE TYPE public.recommendation_status AS ENUM ('accepted','modified','rejected');

-- JUDGES
CREATE TABLE public.judges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialisation text NOT NULL DEFAULT '',
  current_workload integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.judges TO authenticated;
GRANT ALL ON public.judges TO service_role;
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view judges" ON public.judges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage judges" ON public.judges FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- COURTROOMS
CREATE TABLE public.courtrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'general',
  current_allocation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courtrooms TO authenticated;
GRANT ALL ON public.courtrooms TO service_role;
ALTER TABLE public.courtrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view courtrooms" ON public.courtrooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage courtrooms" ON public.courtrooms FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CASE CATEGORIES
CREATE TABLE public.case_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  typical_duration_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_categories TO authenticated;
GRANT ALL ON public.case_categories TO service_role;
ALTER TABLE public.case_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view categories" ON public.case_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.case_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CASES
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.case_categories(id) ON DELETE SET NULL,
  filing_date date NOT NULL DEFAULT current_date,
  status public.case_status NOT NULL DEFAULT 'filed',
  parties text NOT NULL DEFAULT '',
  estimated_duration_minutes integer NOT NULL DEFAULT 60,
  pending_duration_days integer NOT NULL DEFAULT 0,
  previous_adjournments integer NOT NULL DEFAULT 0,
  priority_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view cases" ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage cases" ON public.cases FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- HEARING SLOTS
CREATE TABLE public.hearing_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, start_time, end_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hearing_slots TO authenticated;
GRANT ALL ON public.hearing_slots TO service_role;
ALTER TABLE public.hearing_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view slots" ON public.hearing_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage slots" ON public.hearing_slots FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- AVAILABILITY
CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL,
  entity_id uuid NOT NULL,
  date date NOT NULL,
  slot_id uuid NOT NULL REFERENCES public.hearing_slots(id) ON DELETE CASCADE,
  status public.availability_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, slot_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view availability" ON public.availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage availability" ON public.availability FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- SCHEDULES
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  judge_id uuid REFERENCES public.judges(id) ON DELETE SET NULL,
  courtroom_id uuid REFERENCES public.courtrooms(id) ON DELETE SET NULL,
  slot_id uuid REFERENCES public.hearing_slots(id) ON DELETE SET NULL,
  status public.schedule_status NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX schedules_one_active_per_case ON public.schedules (case_id)
  WHERE status IN ('proposed','confirmed');
CREATE INDEX schedules_judge_idx ON public.schedules (judge_id);
CREATE INDEX schedules_courtroom_idx ON public.schedules (courtroom_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view schedules" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage schedules" ON public.schedules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- ADJOURNMENTS
CREATE TABLE public.adjournments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  previous_slot_id uuid REFERENCES public.hearing_slots(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adjournments_case_idx ON public.adjournments (case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adjournments TO authenticated;
GRANT ALL ON public.adjournments TO service_role;
ALTER TABLE public.adjournments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view adjournments" ON public.adjournments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage adjournments" ON public.adjournments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- AI RECOMMENDATIONS
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL UNIQUE REFERENCES public.schedules(id) ON DELETE CASCADE,
  reasoning text NOT NULL DEFAULT '',
  status public.recommendation_status NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view recommendations" ON public.ai_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage recommendations" ON public.ai_recommendations FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_affected text NOT NULL DEFAULT '',
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_idx ON public.audit_logs (user_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER trg_judges_updated BEFORE UPDATE ON public.judges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_courtrooms_updated BEFORE UPDATE ON public.courtrooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_case_categories_updated BEFORE UPDATE ON public.case_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hearing_slots_updated BEFORE UPDATE ON public.hearing_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_availability_updated BEFORE UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_adjournments_updated BEFORE UPDATE ON public.adjournments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_recommendations_updated BEFORE UPDATE ON public.ai_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();