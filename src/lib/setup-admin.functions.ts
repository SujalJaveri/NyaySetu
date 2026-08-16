import { createServerFn } from "@tanstack/react-start";

export type SetupAdminInput = {
  email: string;
  password: string;
  fullName: string;
};

/**
 * One-time public bootstrap: create the first administrator account if no
 * admin role exists yet. After this, the route redirects to /auth.
 */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: SetupAdminInput) => {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!email.includes("@")) throw new Error("A valid official email is required.");
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!fullName) throw new Error("A full name is required.");
    return { email, password: input.password, fullName };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Guard: only allow when no admin exists
    const { data: existingRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    if (rolesError) throw new Error(rolesError.message);
    if (existingRoles && existingRoles.length > 0) {
      throw new Error("An administrator already exists. Sign in at /auth to manage accounts.");
    }

    let userId: string | null = null;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "admin" },
    });

    if (createError) {
      const alreadyExists = /already been registered|already exists/i.test(createError.message);
      if (!alreadyExists) throw new Error(createError.message);

      // Account exists but has no admin role yet: promote it and reset the password.
      let page = 1;
      while (!userId && page <= 20) {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listError) throw new Error(listError.message);
        const match = list.users.find((u) => u.email?.toLowerCase() === data.email);
        if (match) userId = match.id;
        if (!list.users.length || list.users.length < 200) break;
        page += 1;
      }
      if (!userId) throw new Error("An account with this email exists but could not be located.");

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, role: "admin" },
      });
      if (updateError) throw new Error(updateError.message);
    } else {
      userId = created.user?.id ?? null;
    }

    if (!userId) throw new Error("Account creation failed.");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { email: data.email, id: userId };
  });
