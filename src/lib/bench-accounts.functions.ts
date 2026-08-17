import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { judgeId: string; email: string; password: string; fullName: string };

/**
 * Administrator-only: issues a bench (judge) login and links it to a judge record.
 * The account carries the `judge` role, so row-level security scopes every read to
 * that judge's own listings.
 */
export const createBenchLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Input) => {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("A valid official email is required.");
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!input.judgeId) throw new Error("A judge record is required.");
    return { ...input, email };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Only administrators can issue bench logins.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "judge" },
    });
    if (createError || !created.user)
      throw new Error(createError?.message ?? "Account could not be created.");

    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "judge" });
    if (roleInsertError) throw new Error(roleInsertError.message);

    const { error: linkError } = await supabaseAdmin
      .from("judges")
      .update({ user_id: userId })
      .eq("id", data.judgeId);
    if (linkError) throw new Error(linkError.message);

    return { userId, email: data.email };
  });
