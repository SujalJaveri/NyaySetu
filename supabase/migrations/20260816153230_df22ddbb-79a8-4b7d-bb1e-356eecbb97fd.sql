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