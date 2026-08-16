ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS example_order integer,
  ADD COLUMN IF NOT EXISTS example_label text,
  ADD COLUMN IF NOT EXISTS example_note text;