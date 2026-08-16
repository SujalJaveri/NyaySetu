UPDATE public.schedules SET cause_list_position = NULL WHERE cause_list_position IS NOT NULL;
DELETE FROM public.audit_logs WHERE action LIKE 'Cause list manually reordered%';