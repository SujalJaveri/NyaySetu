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