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