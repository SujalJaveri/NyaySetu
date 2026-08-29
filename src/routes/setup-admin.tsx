import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { createFirstAdmin } from "@/lib/setup-admin.functions";

export const Route = createFileRoute("/setup-admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Initial admin setup — NyayaSetu" },
      {
        name: "description",
        content: "Create the first administrator account for NyayaSetu.",
      },
      { property: "og:title", content: "Initial admin setup — NyayaSetu" },
      {
        property: "og:description",
        content: "Create the first administrator account for NyayaSetu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupAdminPage,
});

function SetupAdminPage() {
  const navigate = useNavigate();
  const createAdmin = useServerFn(createFirstAdmin);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createAdmin({ data: { email, password, fullName } });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary px-12 py-14 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12 bg-white p-0.5 shadow-xs" showLabel />
          <span className="text-sm font-semibold tracking-wide">NyayaSetu</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl leading-snug font-semibold">Initial administrator setup</h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            This one-time page creates the first administrator account. Once an admin exists, it
            cannot be used again.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          Authorised personnel only. Activity may be monitored and recorded.
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-12 bg-white p-0.5 shadow-xs" showLabel />
            <span className="text-sm font-semibold">NyayaSetu</span>
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
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Create admin account</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the official details for the first court administrator.
          </p>

          {success ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-700">
                Administrator account created successfully.
              </div>
              <Button className="w-full" onClick={() => navigate({ to: "/auth", replace: true })}>
                Sign in now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. A. R. Registrar"
                />
              </div>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
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
                Create administrator
              </Button>
            </form>
          )}

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="font-medium text-primary underline underline-offset-4">
              Sign in here
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
