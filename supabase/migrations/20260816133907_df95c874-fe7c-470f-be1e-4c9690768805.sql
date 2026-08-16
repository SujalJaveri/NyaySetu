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