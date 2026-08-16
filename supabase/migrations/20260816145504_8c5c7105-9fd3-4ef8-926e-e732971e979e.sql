ALTER TABLE public.priority_settings
  ADD COLUMN IF NOT EXISTS sched_specialisation_weight numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS sched_workload_weight numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sched_priority_weight numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS sched_utilisation_weight numeric NOT NULL DEFAULT 15;