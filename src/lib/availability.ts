import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";

export type EntityType = "judge" | "courtroom";
export type AvailabilityStatus = "available" | "unavailable";

export type HearingSlot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
};

export type AvailabilityRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  date: string;
  slot_id: string;
  status: AvailabilityStatus;
};

/** Default working-day slot grid used when a date has no hearing slots yet. */
export const DEFAULT_SLOT_GRID: { start: string; end: string }[] = [
  { start: "09:30", end: "10:30" },
  { start: "10:30", end: "11:30" },
  { start: "11:30", end: "12:30" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatTimeRange = (slot: HearingSlot) =>
  `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;

export function hearingSlotsByDateQuery(date: string) {
  return {
    queryKey: ["hearing-slots", date],
    queryFn: async (): Promise<HearingSlot[]> => {
      const { data, error } = await supabase
        .from("hearing_slots")
        .select("id, date, start_time, end_time")
        .eq("date", date)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as HearingSlot[];
    },
  };
}

/** Availability for one entity on one date — the shape the scheduling engine queries. */
export function availabilityQuery(entityType: EntityType, entityId: string, date: string) {
  return {
    queryKey: ["availability", entityType, entityId, date],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const { data, error } = await supabase
        .from("availability")
        .select("id, entity_type, entity_id, date, slot_id, status")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("date", date);
      if (error) throw error;
      return (data ?? []) as AvailabilityRow[];
    },
  };
}

/** All availability records for an entity — used for month-level summaries. */
export function entityAvailabilityQuery(entityType: EntityType, entityId: string) {
  return {
    queryKey: ["availability", entityType, entityId, "all"],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const { data, error } = await supabase
        .from("availability")
        .select("id, entity_type, entity_id, date, slot_id, status")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return (data ?? []) as AvailabilityRow[];
    },
  };
}

/** Creates the standard slot grid for a date when none exists yet. */
export async function ensureSlotsForDate(date: string): Promise<HearingSlot[]> {
  const { data: existing, error } = await supabase
    .from("hearing_slots")
    .select("id, date, start_time, end_time")
    .eq("date", date)
    .order("start_time");
  if (error) throw error;
  if ((existing ?? []).length > 0) return existing as HearingSlot[];

  const { data, error: insertError } = await supabase
    .from("hearing_slots")
    .insert(DEFAULT_SLOT_GRID.map((s) => ({ date, start_time: s.start, end_time: s.end })))
    .select("id, date, start_time, end_time");
  if (insertError) throw insertError;
  return (data ?? []) as HearingSlot[];
}

/** Marks one slot available/unavailable for an entity (insert or update). */
export async function setSlotAvailability(params: {
  entityType: EntityType;
  entityId: string;
  date: string;
  slotId: string;
  status: AvailabilityStatus;
}) {
  const { error } = await supabase.from("availability").upsert(
    {
      entity_type: params.entityType,
      entity_id: params.entityId,
      date: params.date,
      slot_id: params.slotId,
      status: params.status,
    },
    { onConflict: "entity_type,entity_id,slot_id" },
  );
  if (error) throw error;
  await recordAudit(
    `Availability change — ${params.entityType} marked ${params.status} for one slot on ${params.date}`,
    `${params.entityType}:${params.entityId} date:${params.date}`,
  );
}

/** Applies one status to every slot on a date. */
export async function setDayAvailability(params: {
  entityType: EntityType;
  entityId: string;
  date: string;
  slotIds: string[];
  status: AvailabilityStatus;
}) {
  if (params.slotIds.length === 0) return;
  const { error } = await supabase.from("availability").upsert(
    params.slotIds.map((slotId) => ({
      entity_type: params.entityType,
      entity_id: params.entityId,
      date: params.date,
      slot_id: slotId,
      status: params.status,
    })),
    { onConflict: "entity_type,entity_id,slot_id" },
  );
  if (error) throw error;
  await recordAudit(
    `Availability change — ${params.entityType} marked ${params.status} for all ${params.slotIds.length} slot(s) on ${params.date}`,
    `${params.entityType}:${params.entityId} date:${params.date}`,
  );
}

/** Removes explicit records so the slots fall back to "not set". */
export async function clearDayAvailability(params: {
  entityType: EntityType;
  entityId: string;
  date: string;
}) {
  const { error } = await supabase
    .from("availability")
    .delete()
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .eq("date", params.date);
  if (error) throw error;
  await recordAudit(
    `Availability change — cleared all ${params.entityType} availability records for ${params.date}`,
    `${params.entityType}:${params.entityId} date:${params.date}`,
  );
}
