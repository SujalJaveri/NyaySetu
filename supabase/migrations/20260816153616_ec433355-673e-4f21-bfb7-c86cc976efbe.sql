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