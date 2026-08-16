ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_ftsc_pocso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS senior_citizen_litigant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_dispute_5yr_plus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS statutory_limitation_deadline date;