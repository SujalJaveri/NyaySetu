ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS priority_tier text;

ALTER TABLE public.priority_settings
  ADD COLUMN IF NOT EXISTS ftsc_pocso_weight numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS senior_citizen_weight numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS property_dispute_weight numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS limitation_deadline_weight numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS limitation_horizon_days integer NOT NULL DEFAULT 90;