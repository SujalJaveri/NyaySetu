import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "admin" | "registrar" | "judge";

export type CurrentStaff = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  /** Judge record linked to this login, when the account is a bench account. */
  judgeId: string | null;
  judgeName: string | null;
};

export function useCurrentStaff() {
  return useQuery<CurrentStaff | null>({
    queryKey: ["current-staff"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }, { data: bench }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("judges").select("id, name").eq("user_id", user.id).maybeSingle(),
      ]);

      const has = (r: string) => roles?.some((row) => row.role === r) ?? false;
      const role: StaffRole = has("admin")
        ? "admin"
        : has("registrar")
          ? "registrar"
          : has("judge")
            ? "judge"
            : "registrar";

      return {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name?.trim() || (user.email ?? "").split("@")[0] || "Staff",
        role,
        judgeId: bench?.id ?? null,
        judgeName: bench?.name ?? null,
      };
    },
    staleTime: 60_000,
  });
}

/**
 * UI-level permission gates. These mirror the database RLS policies so unauthorised
 * roles never see an action they cannot complete.
 */
export type StaffPermissions = {
  canManageRegistry: boolean;
  canManageSettings: boolean;
  canSchedule: boolean;
  canEditAvailability: boolean;
  /** Bench accounts get a read-only, self-scoped view of the registry. */
  isJudge: boolean;
};

export function permissionsFor(role: StaffRole | null | undefined): StaffPermissions {
  return {
    canManageRegistry: role === "admin",
    canManageSettings: role === "admin",
    canSchedule: role === "admin" || role === "registrar",
    canEditAvailability: role === "admin" || role === "registrar",
    isJudge: role === "judge",
  };
}

/** Convenience hook: current staff permissions (all false until the role is known). */
export function usePermissions(): StaffPermissions & { ready: boolean } {
  const staff = useCurrentStaff();
  return { ...permissionsFor(staff.data?.role), ready: !staff.isLoading };
}

export const roleLabel: Record<StaffRole, string> = {
  admin: "Administrator",
  registrar: "Registrar",
  judge: "Judge",
};
