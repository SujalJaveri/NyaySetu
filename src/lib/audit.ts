import { supabase } from "@/integrations/supabase/client";

/**
 * Accountability trail. Every meaningful registry action writes one row here so
 * an AI-assisted decision can always be traced back to the human who took it.
 */

export type AuditActionType =
  | "case"
  | "schedule"
  | "recommendation"
  | "availability"
  | "simulation"
  | "registry"
  | "settings"
  | "other";

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_affected: string;
  timestamp: string;
};

export type AuditLogEntry = AuditLogRow & {
  userName: string;
  userRole: string;
  actionType: AuditActionType;
  entityLabel: string;
};

export const AUDIT_ACTION_TYPES: { value: AuditActionType; label: string }[] = [
  { value: "case", label: "Case record" },
  { value: "schedule", label: "Schedule created / modified" },
  { value: "recommendation", label: "Scheduling recommendation decision" },
  { value: "availability", label: "Availability change" },
  { value: "simulation", label: "What-If Simulation applied" },
  { value: "registry", label: "Judge / courtroom registry" },
  { value: "settings", label: "Priority Score settings" },
  { value: "other", label: "Other" },
];

export const auditActionLabel: Record<AuditActionType, string> = Object.fromEntries(
  AUDIT_ACTION_TYPES.map((t) => [t.value, t.label]),
) as Record<AuditActionType, string>;

/** Derives a coarse action type from the recorded action text (deterministic). */
export function classifyAction(action: string): AuditActionType {
  const a = action.toLowerCase();
  if (a.includes("what-if simulation")) return "simulation";
  if (a.includes("recommendation")) return "recommendation";
  if (a.includes("availability")) return "availability";
  if (a.includes("schedule") || a.includes("listing") || a.includes("reassign")) return "schedule";
  if (a.includes("case")) return "case";
  if (a.includes("judge") || a.includes("courtroom")) return "registry";
  if (a.includes("priority") || a.includes("setting")) return "settings";
  return "other";
}

/** Turns "case:CASE-2026-0001 schedule:uuid" into a readable label. */
export function formatEntity(entity: string): string {
  if (!entity.trim()) return "—";
  return entity
    .split(/\s+(?=[a-z_]+:)/i)
    .map((part) => {
      const [kind = "", ...rest] = part.split(":");
      const value = rest.join(":");
      if (!value) return part;
      const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
      const short = value.length >= 32 && value.includes("-") ? `${value.slice(0, 8)}…` : value;
      return `${kindLabel}: ${short}`;
    })
    .join(" · ");
}

/**
 * Writes one audit entry for the signed-in user. Never throws — a failed audit
 * write must not roll back or block the action the registrar already completed,
 * but it is surfaced in the console for diagnosis.
 */
export async function recordAudit(action: string, entityAffected: string, userId?: string) {
  try {
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id;
    }
    if (!uid) return;
    const { error } = await supabase
      .from("audit_logs")
      .insert({ user_id: uid, action, entity_affected: entityAffected });
    if (error) throw error;
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}

/** Full activity trail joined with the acting staff member's name and role. */
export const auditLogQuery = {
  queryKey: ["audit-logs"],
  queryFn: async (): Promise<AuditLogEntry[]> => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_affected, timestamp")
      .order("timestamp", { ascending: false })
      .limit(1000);
    if (error) throw error;
    const rows = (data ?? []) as AuditLogRow[];

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Registry staff"]),
    );
    const roleById = new Map<string, string>();
    for (const r of roles ?? []) {
      const label = r.role === "admin" ? "Administrator" : "Registrar";
      // Admin wins when a user holds both roles.
      if (r.role === "admin" || !roleById.has(r.user_id)) roleById.set(r.user_id, label);
    }

    return rows.map((row) => ({
      ...row,
      userName: (row.user_id && nameById.get(row.user_id)) || "System",
      userRole: (row.user_id && roleById.get(row.user_id)) || "—",
      actionType: classifyAction(row.action),
      entityLabel: formatEntity(row.entity_affected),
    }));
  },
};

export function formatAuditTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
