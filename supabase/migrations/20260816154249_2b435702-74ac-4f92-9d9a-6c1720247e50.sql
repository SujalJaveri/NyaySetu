REVOKE EXECUTE ON FUNCTION public.current_judge_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_registry_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_judge_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_registry_staff() TO authenticated, service_role;