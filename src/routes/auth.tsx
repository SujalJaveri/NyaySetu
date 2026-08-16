import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Gavel, ClipboardList, ArrowLeft } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type PortalRole = "judge" | "registrar";

const roleCopy: Record<
  PortalRole,
  { eyebrow: string; heading: string; blurb: string; icon: typeof Gavel; note: string }
> = {
  judge: {
    eyebrow: "Bench access",
    heading: "Judge sign in",
    blurb: "Use the bench credentials issued to you by the registry administrator.",
    icon: Gavel,
    note: "Bench accounts are provisioned by the registry. If you have not received credentials, contact the court administrator.",
  },
  registrar: {
    eyebrow: "Registry access",
    heading: "Registrar sign in",
    blurb: "Use the credentials issued by the registry administrator.",
    icon: ClipboardList,
    note: "Accounts are provisioned manually. There is no public registration — contact the court administrator to request access.",
  },
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { role?: PortalRole } => ({
    role: search["role"] === "judge" ? "judge" : "registrar",
  }),

  head: () => ({
    meta: [
      { title: "Staff Sign In — NyaySetu" },
      {
        name: "description",
        content: "Secure sign-in for judges, court administrators and registrar staff.",
      },
      { property: "og:title", content: "Staff Sign In — NyaySetu" },
      {
        property: "og:description",
        content: "Secure sign-in for judges, court administrators and registrar staff.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const role: PortalRole = search.role ?? "registrar";
  const copy = roleCopy[role];

  const RoleIcon = copy.icon;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError || !data.user) {
      setError("Invalid credentials. Contact your administrator if the issue persists.");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isJudge = roles?.some((r) => r.role === "judge");
    navigate({ to: isJudge ? "/bench" : "/dashboard", replace: true });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary px-12 py-14 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12 bg-primary-foreground p-1" showLabel />
          <span className="text-sm font-semibold tracking-wide">NyaySetu</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl leading-snug font-semibold">
            Orderly listings. Fewer conflicts. Faster justice.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            A single registry workspace for cause lists, judge availability, courtroom allocation
            and hearing schedules.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          Authorised personnel only. Activity may be monitored and recorded.
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-12 p-1" showLabel />
            <span className="text-sm font-semibold">NyaySetu</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to portal
          </Link>

          <div className="mt-5 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <RoleIcon className="size-4" />
            </span>
            <div>
              <p className="text-eyebrow">{copy.eyebrow}</p>
              <h1 className="text-2xl font-semibold text-foreground">{copy.heading}</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{copy.blurb}</p>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
            {(["judge", "registrar"] as PortalRole[]).map((r) => (
              <Link
                key={r}
                to="/auth"
                search={{ role: r }}
                replace
                className={`rounded-sm px-3 py-2 text-center text-xs font-medium transition-colors ${
                  role === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r === "judge" ? "Judge" : "Registrar / Admin"}
              </Link>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Official email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@courts.gov"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>

          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Are you a litigant?{" "}
            <Link
              to="/case-status"
              className="font-medium text-primary underline underline-offset-4"
            >
              Check your case status
            </Link>{" "}
            — no sign-in required.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            First time setting up the registry?{" "}
            <Link
              to="/setup-admin"
              className="font-medium text-primary underline underline-offset-4"
            >
              Create the initial administrator
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
