DELETE FROM public.availability a
USING public.availability b
WHERE a.ctid < b.ctid
  AND a.entity_type = b.entity_type
  AND a.entity_id = b.entity_id
  AND a.slot_id = b.slot_id;

CREATE UNIQUE INDEX IF NOT EXISTS availability_entity_slot_key
  ON public.availability (entity_type, entity_id, slot_id);

CREATE INDEX IF NOT EXISTS availability_entity_date_idx
  ON public.availability (entity_type, entity_id, date);

CREATE INDEX IF NOT EXISTS availability_date_slot_idx
  ON public.availability (date, slot_id);

CREATE INDEX IF NOT EXISTS hearing_slots_date_idx
  ON public.hearing_slots (date, start_time);