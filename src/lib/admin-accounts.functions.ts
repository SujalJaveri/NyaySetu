import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RegistryRole = "admin" | "registrar" | "judge";

export type RegistryAccount = {
  id: string;
  email: string;
  fullName: string;
  role: RegistryRole | null;
  createdAt: string;
  lastSignInAt: string | null;
  judgeId: string | null;
  judgeName: string | null;
};

/** Administrator-only: full list of registry logins with their role and bench link. */
export const listRegistryAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegistryAccount[]> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can manage registry accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw new Error(listError.message);

    const [{ data: profiles }, { data: roles }, { data: judges }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("judges").select("id, name, user_id"),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    const roleById = new Map((roles ?? []).map((r) => [r.user_id, r.role as RegistryRole]));
    const benchById = new Map(
      (judges ?? []).filter((j) => j.user_id).map((j) => [j.user_id as string, j]),
    );

    return userList.users
      .map((u) => {
        const bench = benchById.get(u.id);
        return {
          id: u.id,
          email: u.email ?? "",
          fullName: (nameById.get(u.id) || "").trim() || (u.email ?? "").split("@")[0] || "Account",
          role: roleById.get(u.id) ?? null,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
          judgeId: bench?.id ?? null,
          judgeName: bench?.name ?? null,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  });

/** Administrator-only: creates a registrar, administrator or bench login. */
export const createRegistryAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      email: string;
      password: string;
      fullName: string;
      role: RegistryRole;
      judgeId?: string | null;
    }) => {
      const email = input.email.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("A valid official email is required.");
      if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
      if (!input.fullName.trim()) throw new Error("A full name is required.");
      if (input.role === "judge" && !input.judgeId)
        throw new Error("Select the judge record this bench login belongs to.");
      return { ...input, email, fullName: input.fullName.trim() };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can create registry accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role },
    });
    if (createError || !created.user)
      throw new Error(createError?.message ?? "Account could not be created.");

    const userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    if (data.role === "judge" && data.judgeId) {
      const { error: linkError } = await supabaseAdmin
        .from("judges")
        .update({ user_id: userId })
        .eq("id", data.judgeId);
      if (linkError) throw new Error(linkError.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: `Created ${data.role} account for ${data.email}`,
      entity_affected: "user_accounts",
    });

    return { userId, email: data.email };
  });

/** Administrator-only: changes the role carried by an existing login. */
export const updateRegistryAccountRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; role: RegistryRole; judgeId?: string | null }) => {
    if (!input.userId) throw new Error("An account is required.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can change account roles.");
    if (data.userId === context.userId && data.role !== "admin")
      throw new Error("You cannot remove your own administrator role.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    if (data.role === "judge") {
      if (data.judgeId) {
        const { error: linkError } = await supabaseAdmin
          .from("judges")
          .update({ user_id: data.userId })
          .eq("id", data.judgeId);
        if (linkError) throw new Error(linkError.message);
      }
    } else {
      await supabaseAdmin.from("judges").update({ user_id: null }).eq("user_id", data.userId);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: `Changed account role to ${data.role}`,
      entity_affected: "user_accounts",
    });

    return { ok: true };
  });

/** Administrator-only: issues a new password for an existing login. */
export const resetRegistryAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; password: string }) => {
    if (!input.userId) throw new Error("An account is required.");
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can reset passwords.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "Reset an account password",
      entity_affected: "user_accounts",
    });

    return { ok: true };
  });

/** Administrator-only: revokes a login. Judge records themselves are never deleted. */
export const deleteRegistryAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => {
    if (!input.userId) throw new Error("An account is required.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can revoke accounts.");
    if (data.userId === context.userId) throw new Error("You cannot revoke your own login.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("judges").update({ user_id: null }).eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "Revoked a registry login",
      entity_affected: "user_accounts",
    });

    return { ok: true };
  });

export type AdminOverview = {
  cases: { total: number; filed: number; scheduled: number; adjourned: number; disposed: number };
  tiers: { tier1: number; tier2: number; tier3: number };
  judges: number;
  courtrooms: number;
  activeSchedules: number;
  unlinkedJudges: number;
  recentActivity: { id: string; action: string; entity: string; at: string }[];
};

/** Administrator-only: aggregate registry health figures for the admin panel. */
export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can view registry figures.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [cases, judges, courtrooms, schedules, audit] = await Promise.all([
      supabaseAdmin.from("cases").select("status, priority_tier"),
      supabaseAdmin.from("judges").select("id, user_id"),
      supabaseAdmin.from("courtrooms").select("id"),
      supabaseAdmin.from("schedules").select("status"),
      supabaseAdmin
        .from("audit_logs")
        .select("id, action, entity_affected, timestamp")
        .order("timestamp", { ascending: false })
        .limit(12),
    ]);

    const caseRows = cases.data ?? [];
    const count = (status: string) => caseRows.filter((c) => c.status === status).length;
    const tier = (name: string) => caseRows.filter((c) => c.priority_tier === name).length;

    return {
      cases: {
        total: caseRows.length,
        filed: count("filed"),
        scheduled: count("scheduled"),
        adjourned: count("adjourned"),
        disposed: count("disposed"),
      },
      tiers: { tier1: tier("Tier 1"), tier2: tier("Tier 2"), tier3: tier("Tier 3") },
      judges: (judges.data ?? []).length,
      courtrooms: (courtrooms.data ?? []).length,
      activeSchedules: (schedules.data ?? []).filter(
        (s) => s.status === "proposed" || s.status === "confirmed",
      ).length,
      unlinkedJudges: (judges.data ?? []).filter((j) => !j.user_id).length,
      recentActivity: (audit.data ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity_affected,
        at: a.timestamp,
      })),
    };
  });

/** Administrator-only: renames the person behind a login. */
export const updateRegistryAccountName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; fullName: string }) => {
    const fullName = input.fullName.trim();
    if (!input.userId) throw new Error("An account is required.");
    if (!fullName) throw new Error("A full name is required.");
    return { userId: input.userId, fullName };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can amend accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: data.userId, full_name: data.fullName }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { full_name: data.fullName },
    });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: `Renamed a registry account to ${data.fullName}`,
      entity_affected: "user_accounts",
    });
    return { ok: true };
  });
