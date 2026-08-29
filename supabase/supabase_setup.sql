CREATE TYPE public.app_role AS ENUM ('admin', 'registrar');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Staff can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'registrar'))
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;



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



ALTER TABLE public.case_categories ADD COLUMN IF NOT EXISTS urgency_weight integer NOT NULL DEFAULT 50;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS legal_priority_flag boolean NOT NULL DEFAULT false;

UPDATE public.case_categories SET urgency_weight = 85 WHERE lower(name) LIKE '%criminal%';
UPDATE public.case_categories SET urgency_weight = 75 WHERE lower(name) LIKE '%family%';
UPDATE public.case_categories SET urgency_weight = 60 WHERE lower(name) LIKE '%civil%';

CREATE TABLE public.priority_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  category_weight numeric NOT NULL DEFAULT 30,
  pending_weight numeric NOT NULL DEFAULT 40,
  adjournment_weight numeric NOT NULL DEFAULT 20,
  boost_points numeric NOT NULL DEFAULT 10,
  pending_cap_days integer NOT NULL DEFAULT 365,
  adjournment_cap integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT priority_settings_singleton_key UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE ON public.priority_settings TO authenticated;
GRANT ALL ON public.priority_settings TO service_role;

ALTER TABLE public.priority_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view priority settings" ON public.priority_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage priority settings" ON public.priority_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_priority_settings_updated BEFORE UPDATE ON public.priority_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.priority_settings (singleton) VALUES (true);



DELETE FROM public.availability a
USING public.availability b
WHERE a.ctid < b.ctid
  AND a.entity_type = b.entity_type
  AND a.entity_id = b.entity_id
  AND a.slot_id = b.slot_id;

CREATE UNIQUE INDEX IF NOT EXISTS availability_entity_slot_key
  ON public.availability (entity_type, entity_id, slot_id);

CREATE INDEX IF NOT EXISTS availability_entity_date_idx
  ON public.availability (entity_type, entity_id, date);

CREATE INDEX IF NOT EXISTS availability_date_slot_idx
  ON public.availability (date, slot_id);

CREATE INDEX IF NOT EXISTS hearing_slots_date_idx
  ON public.hearing_slots (date, start_time);



ALTER TABLE public.priority_settings ADD COLUMN IF NOT EXISTS max_judge_workload integer NOT NULL DEFAULT 25;



DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;

CREATE POLICY "Staff view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'registrar'::public.app_role)
);

CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs (timestamp DESC);



INSERT INTO public.audit_logs (user_id, action, entity_affected, timestamp)
SELECT p.id, v.action, v.entity, now() - v.ago
FROM public.profiles p
CROSS JOIN (VALUES
  ('Registered case CASE-2026-0016', 'case:CASE-2026-0016', interval '9 days'),
  ('Registered case CASE-2026-0017', 'case:CASE-2026-0017', interval '8 days 4 hours'),
  ('Availability change — judge marked unavailable for all 6 slot(s) on 2026-08-18', 'judge:Hon. Aruna Sethi', interval '7 days'),
  ('Accepted AI Recommendation — listing created', 'case:CASE-2026-0002 schedule:seeded', interval '6 days 2 hours'),
  ('Accepted AI Recommendation — listing created', 'case:CASE-2026-0005 schedule:seeded', interval '5 days 6 hours'),
  ('Modified AI Recommendation (chose an alternative valid slot) — listing created', 'case:CASE-2026-0007 schedule:seeded', interval '4 days 3 hours'),
  ('Rejected AI Recommendation — no listing confirmed', 'case:CASE-2026-0011 schedule:seeded', interval '3 days 5 hours'),
  ('Availability change — courtroom marked unavailable for one slot on 2026-08-20', 'courtroom:Court Hall 2', interval '2 days 7 hours'),
  ('Applied legal/administrative priority boost on case CASE-2026-0013', 'case:CASE-2026-0013', interval '2 days'),
  ('Applied what-if simulation — Hon. Aruna Sethi marked unavailable on 2026-08-18; 2 hearing(s) reassigned', 'judge:Hon. Aruna Sethi date:2026-08-18', interval '1 day 4 hours'),
  ('Updated Priority Score settings', 'settings:priority_settings', interval '20 hours'),
  ('Registered case CASE-2026-0018', 'case:CASE-2026-0018', interval '6 hours')
) AS v(action, entity, ago)
WHERE p.full_name = 'sujaljaveri24';




-- 1. Category
insert into public.case_categories (name, typical_duration_minutes, urgency_weight)
values ('Commercial Dispute', 60, 95)
on conflict do nothing;

-- 2. Judge + courtroom from the demo scenario
insert into public.judges (name, specialisation, current_workload)
select 'Hon. Anjali Rao', 'Commercial Law', 4
where not exists (select 1 from public.judges where name = 'Hon. Anjali Rao');

insert into public.courtrooms (name, capacity, type, current_allocation)
select 'Courtroom 3', 40, 'general', 0
where not exists (select 1 from public.courtrooms where name = 'Courtroom 3');

-- Existing commercial judge already carries a heavier docket
update public.judges set current_workload = 9 where name = 'Hon. Nikhil Barua';

-- 3. Case CASE-2026-0012
update public.cases c
set category_id = (select id from public.case_categories where name = 'Commercial Dispute'),
    filing_date = current_date - 52,
    pending_duration_days = 52,
    previous_adjournments = 1,
    estimated_duration_minutes = 60,
    status = 'filed'
where c.case_number = 'CASE-2026-0012';

insert into public.adjournments (case_id, reason)
select c.id, 'Counsel for the respondent sought time to file a reply affidavit.'
from public.cases c
where c.case_number = 'CASE-2026-0012'
  and not exists (select 1 from public.adjournments a where a.case_id = c.id);

-- 4. Give Annexe Hall a booking so courtroom utilisation is meaningfully differentiated
insert into public.schedules (case_id, judge_id, courtroom_id, slot_id, status)
select c.id, j.id, r.id, s.id, 'confirmed'
from public.cases c,
     public.judges j,
     public.courtrooms r,
     (select id from public.hearing_slots where date >= current_date order by date desc, start_time desc limit 1) s
where c.case_number = 'CASE-2026-0014'
  and j.name = 'Hon. Samir Vaidya'
  and r.name = 'Annexe Hall'
  and not exists (select 1 from public.schedules x where x.case_id = c.id and x.status in ('proposed','confirmed'));

update public.cases set status = 'scheduled' where case_number = 'CASE-2026-0014';
update public.courtrooms set current_allocation = current_allocation + 1 where name = 'Annexe Hall';
update public.judges set current_workload = current_workload + 1 where name = 'Hon. Samir Vaidya';

-- 5. Sharpen the configurable caps so ageing and repeat adjournments register properly
update public.priority_settings set pending_cap_days = 60, adjournment_cap = 2;

-- 6. Recompute every priority score with the same deterministic formula the app uses
update public.cases c
set priority_score = round((
      ps.category_weight * (coalesce(cat.urgency_weight, 50) / 100.0)
    + ps.pending_weight  * least(1.0, greatest(0.0, (current_date - c.filing_date)::numeric / greatest(1, ps.pending_cap_days)))
    + ps.adjournment_weight * least(1.0, c.previous_adjournments::numeric / greatest(1, ps.adjournment_cap))
    + case when c.legal_priority_flag then ps.boost_points else 0 end
    )::numeric, 1),
    pending_duration_days = greatest(0, current_date - c.filing_date)
from public.priority_settings ps
left join lateral (select 1) dummy on true
left join public.case_categories cat on true
where cat.id is not distinct from c.category_id;



ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS example_order integer,
  ADD COLUMN IF NOT EXISTS example_label text,
  ADD COLUMN IF NOT EXISTS example_note text;



ALTER TABLE public.priority_settings
  ADD COLUMN IF NOT EXISTS sched_specialisation_weight numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS sched_workload_weight numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sched_priority_weight numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS sched_utilisation_weight numeric NOT NULL DEFAULT 15;



ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_ftsc_pocso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS senior_citizen_litigant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_dispute_5yr_plus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS statutory_limitation_deadline date;



ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS priority_tier text;

ALTER TABLE public.priority_settings
  ADD COLUMN IF NOT EXISTS ftsc_pocso_weight numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS senior_citizen_weight numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS property_dispute_weight numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS limitation_deadline_weight numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS limitation_horizon_days integer NOT NULL DEFAULT 90;



ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS cause_list_position integer;



UPDATE public.schedules SET cause_list_position = NULL WHERE cause_list_position IS NOT NULL;
DELETE FROM public.audit_logs WHERE action LIKE 'Cause list manually reordered%';



CREATE TABLE public.notifications_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  recipient text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications_log TO authenticated;
GRANT ALL ON public.notifications_log TO service_role;

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view notification log" ON public.notifications_log
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff manage notification log" ON public.notifications_log
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'registrar'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'registrar'::app_role));

CREATE TRIGGER trg_notifications_log_updated BEFORE UPDATE ON public.notifications_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_notifications_log_case ON public.notifications_log(case_id, sent_at DESC);



CREATE TABLE public.case_status_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL,
  language text NOT NULL,
  source_hash text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_number, language, source_hash)
);

GRANT ALL ON public.case_status_translations TO service_role;

ALTER TABLE public.case_status_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view case status translations"
  ON public.case_status_translations FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_case_status_translations_updated
  BEFORE UPDATE ON public.case_status_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'judge';



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



REVOKE EXECUTE ON FUNCTION public.current_judge_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_registry_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_judge_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_registry_staff() TO authenticated, service_role;



CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_judge_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_registry_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_judge_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_registry_staff() TO authenticated, service_role;



-- Helper: is the current user a linked judge?
CREATE OR REPLACE FUNCTION public.is_bench_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.judges WHERE user_id = auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.is_bench_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bench_user() TO authenticated;

-- case_categories
DROP POLICY IF EXISTS "Staff view categories" ON public.case_categories;
CREATE POLICY "Registry staff and bench view categories"
ON public.case_categories FOR SELECT TO authenticated
USING (public.is_registry_staff() OR public.is_bench_user());

-- case_status_translations
DROP POLICY IF EXISTS "Staff view case status translations" ON public.case_status_translations;
CREATE POLICY "Registry staff view case status translations"
ON public.case_status_translations FOR SELECT TO authenticated
USING (public.is_registry_staff());

-- hearing_slots
DROP POLICY IF EXISTS "Staff view slots" ON public.hearing_slots;
CREATE POLICY "Registry staff and bench view slots"
ON public.hearing_slots FOR SELECT TO authenticated
USING (public.is_registry_staff() OR public.is_bench_user());

-- priority_settings
DROP POLICY IF EXISTS "Staff view priority settings" ON public.priority_settings;
CREATE POLICY "Registry staff view priority settings"
ON public.priority_settings FOR SELECT TO authenticated
USING (public.is_registry_staff() OR public.is_bench_user());

-- profiles
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
CREATE POLICY "Registry staff view profiles, users view own"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_registry_staff() OR id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Staff can view roles" ON public.user_roles;
CREATE POLICY "Registry staff view roles, users view own"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_registry_staff() OR user_id = auth.uid());

-- Trigger-only functions do not need to be callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- COURT HOLIDAYS & NON-SITTING CALENDAR
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'gazetted' CHECK (type IN ('gazetted','court_vacation','restricted','second_saturday','sunday')),
  jurisdiction text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, jurisdiction)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_holidays TO authenticated;
GRANT ALL ON public.court_holidays TO service_role;

ALTER TABLE public.court_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view holidays" ON public.court_holidays
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage holidays" ON public.court_holidays
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_court_holidays_updated BEFORE UPDATE ON public.court_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS court_holidays_date_idx ON public.court_holidays(date);

-- Seed Indian court holidays & vacation periods for 2026
INSERT INTO public.court_holidays (date, name, type) VALUES
  ('2026-08-15', 'Independence Day', 'gazetted'),
  ('2026-09-04', 'Janmashtami', 'gazetted'),
  ('2026-09-17', 'Milad-un-Nabi', 'gazetted'),
  ('2026-10-02', 'Mahatma Gandhi Jayanti', 'gazetted'),
  ('2026-10-20', 'Maha Navami / Dussehra', 'gazetted'),
  ('2026-10-21', 'Vijaya Dashami', 'gazetted'),
  ('2026-11-08', 'Diwali (Lakshmi Puja)', 'gazetted'),
  ('2026-11-09', 'Govardhan Puja', 'gazetted'),
  ('2026-11-10', 'Bhai Dooj', 'gazetted'),
  ('2026-11-24', 'Guru Nanak Jayanti', 'gazetted'),
  ('2026-12-21', 'Court Winter Vacation Begins', 'court_vacation'),
  ('2026-12-22', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-23', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-24', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-25', 'Christmas Day', 'gazetted'),
  ('2026-12-26', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-28', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-29', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-30', 'Court Winter Vacation', 'court_vacation'),
  ('2026-12-31', 'Court Winter Vacation', 'court_vacation')
ON CONFLICT (date, jurisdiction) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type;

-- CNR Number and Predictive ML fields on cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS cnr_number text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS predicted_duration_minutes integer;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS adjournment_risk_score numeric;
CREATE INDEX IF NOT EXISTS cases_cnr_idx ON public.cases(cnr_number) WHERE cnr_number IS NOT NULL;

-- BNS / BNSS / BSA Categories (Bharatiya Nyaya Sanhita criminal reforms)
INSERT INTO public.case_categories (name, typical_duration_minutes, urgency_weight) VALUES
  ('BNS Criminal Trial (Bharatiya Nyaya Sanhita)', 90, 85),
  ('BNSS Bail & Inquiry (Bharatiya Nagarik Suraksha)', 45, 90),
  ('BSA Evidentiary Matter (Bharatiya Sakshya Adhiniyam)', 60, 75)
ON CONFLICT (name) DO UPDATE SET urgency_weight = EXCLUDED.urgency_weight, typical_duration_minutes = EXCLUDED.typical_duration_minutes;
