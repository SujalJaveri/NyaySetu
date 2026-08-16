import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Copy,
  Gavel,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createRegistryAccount,
  deleteRegistryAccount,
  getAdminOverview,
  listRegistryAccounts,
  resetRegistryAccountPassword,
  updateRegistryAccountName,
  updateRegistryAccountRole,
  type RegistryRole,
} from "@/lib/admin-accounts.functions";
import { judgesQuery } from "@/lib/registry";
import { useCurrentStaff } from "@/hooks/use-current-staff";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — NyaySetu" },
      {
        name: "description",
        content:
          "Administrator control panel for registry logins: create registrar and bench accounts, change roles, reset passwords and revoke access.",
      },
      { property: "og:title", content: "Admin panel — NyaySetu" },
      {
        property: "og:description",
        content: "Manage registrars, administrators and judicial bench logins for NyaySetu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPanelPage,
});

const roleLabels: Record<RegistryRole, string> = {
  admin: "Administrator",
  registrar: "Registrar",
  judge: "Judge (bench)",
};

const roleTone: Record<RegistryRole, string> = {
  admin: "border-primary/40 bg-primary/10 text-primary",
  registrar: "border-border bg-accent text-accent-foreground",
  judge: "border-border bg-secondary text-secondary-foreground",
};

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Copy failed — select the text manually.");
  }
}

function AdminPanelPage() {
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const isAdmin = staff.data?.role === "admin";

  const fetchAccounts = useServerFn(listRegistryAccounts);
  const fetchOverview = useServerFn(getAdminOverview);
  const createAccount = useServerFn(createRegistryAccount);
  const updateRole = useServerFn(updateRegistryAccountRole);
  const updateName = useServerFn(updateRegistryAccountName);
  const resetPassword = useServerFn(resetRegistryAccountPassword);
  const revokeAccount = useServerFn(deleteRegistryAccount);

  const accounts = useQuery({
    queryKey: ["registry-accounts"],
    queryFn: () => fetchAccounts({ data: undefined }),
    enabled: isAdmin,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({ data: undefined }),
    enabled: isAdmin,
  });
  const judges = useQuery({ ...judgesQuery, enabled: isAdmin });

  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RegistryRole>("all");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "registrar" as RegistryRole,
    judgeId: "",
  });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ userId: string; fullName: string } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registry-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["judges"] });
    void queryClient.invalidateQueries({ queryKey: ["bench-accounts"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createAccount({
        data: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          judgeId: form.role === "judge" ? form.judgeId || null : null,
        },
      }),
    onSuccess: () => {
      toast.success(`${roleLabels[form.role]} account created`, {
        description: "Share the temporary password with the account holder.",
      });
      setForm({ fullName: "", email: "", password: "", role: "registrar", judgeId: "" });
      setTab("accounts");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: (input: { userId: string; role: RegistryRole; judgeId?: string | null }) =>
      updateRole({ data: input }),
    onSuccess: () => {
      toast.success("Role updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: (input: { userId: string; fullName: string }) => updateName({ data: input }),
    onSuccess: () => {
      toast.success("Account name updated");
      setRenaming(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: (input: { userId: string; password: string }) => resetPassword({ data: input }),
    onSuccess: (_r, input) => {
      toast.success("Password reset", { description: "Pass the new password on securely." });
      setPasswordDrafts((prev) => ({ ...prev, [input.userId]: "" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeAccount({ data: { userId } }),
    onSuccess: () => {
      toast.success("Login revoked");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = accounts.data ?? [];
  const counts = useMemo(
    () => ({
      admins: rows.filter((a) => a.role === "admin").length,
      registrars: rows.filter((a) => a.role === "registrar").length,
      bench: rows.filter((a) => a.role === "judge").length,
      dormant: rows.filter((a) => !a.lastSignInAt).length,
    }),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((a) => {
      const matchesRole = roleFilter === "all" || a.role === roleFilter;
      const matchesTerm =
        !term ||
        a.fullName.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        (a.judgeName ?? "").toLowerCase().includes(term);
      return matchesRole && matchesTerm;
    });
  }, [rows, search, roleFilter]);
  const unlinkedJudges = (judges.data ?? []).filter((j) => !j.user_id);

  if (staff.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Administration"
          title="Admin panel"
          description="Central control for registry logins, roles and bench access."
        />
        <Card className="mt-8 border-destructive/40">
          <CardContent className="flex items-start gap-3 py-6">
            <ShieldAlert className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Administrator access required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Only administrators may create or amend registry logins. Contact the registry
                administrator if you need an account issued or a role changed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = overview.data;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Administration"
          title="Admin panel"
          description="Issue and manage every registry login — administrators, registrars and judicial bench accounts — and keep an eye on registry health from one place."
        />
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Administrators" value={counts.admins} icon={ShieldCheck} />
        <SummaryCard label="Registrars" value={counts.registrars} icon={Users} />
        <SummaryCard label="Bench logins" value={counts.bench} icon={KeyRound} />
        <SummaryCard label="Never signed in" value={counts.dormant} icon={UserPlus} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="new">Create account</TabsTrigger>
          <TabsTrigger value="bench">Bench links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
          ) : overview.isLoading || !stats ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Caseload</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatRow label="Total cases" value={stats.cases.total} />
                    <StatRow label="Awaiting listing" value={stats.cases.filed} />
                    <StatRow label="Scheduled" value={stats.cases.scheduled} />
                    <StatRow label="Adjourned" value={stats.cases.adjourned} />
                    <StatRow label="Disposed" value={stats.cases.disposed} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Priority tiers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(
                      [
                        ["Tier 1", stats.tiers.tier1],
                        ["Tier 2", stats.tiers.tier2],
                        ["Tier 3", stats.tiers.tier3],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground">{value}</span>
                        </div>
                        <Progress
                          value={stats.cases.total ? (value / stats.cases.total) * 100 : 0}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registry resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatRow label="Judges on the roll" value={stats.judges} />
                    <StatRow label="Judges without a login" value={stats.unlinkedJudges} />
                    <StatRow label="Courtrooms" value={stats.courtrooms} />
                    <StatRow label="Active listings" value={stats.activeSchedules} />
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/judges">
                          <Gavel className="size-4" />
                          Judges
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/courtrooms">Courtrooms</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/priority-settings">Weights</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4" />
                    Latest registry activity
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/activity-log">View full log</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {stats.recentActivity.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                        >
                          <div>
                            <p className="text-sm text-foreground">{entry.action}</p>
                            <p className="text-xs text-muted-foreground">{entry.entity}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          {accounts.isError ? (
            <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
          ) : accounts.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card>
              <CardHeader className="gap-4">
                <CardTitle className="text-base">
                  Registry logins ({filteredRows.length} of {rows.length})
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name, email or bench"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={roleFilter}
                    onValueChange={(value) => setRoleFilter(value as "all" | RegistryRole)}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {(Object.keys(roleLabels) as RegistryRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Bench record</TableHead>
                      <TableHead>Last sign-in</TableHead>
                      <TableHead className="min-w-[300px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No logins match this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {account.fullName}
                              {account.id === staff.data?.id && (
                                <span className="text-xs text-muted-foreground">(you)</span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={`Rename ${account.fullName}`}
                                onClick={() =>
                                  setRenaming({
                                    userId: account.id,
                                    fullName: account.fullName,
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 hover:text-foreground"
                              onClick={() => void copyToClipboard(account.email)}
                            >
                              {account.email}
                              <Copy className="size-3.5" />
                            </button>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={account.role ?? "registrar"}
                              onValueChange={(role) =>
                                changeRole.mutate({
                                  userId: account.id,
                                  role: role as RegistryRole,
                                  judgeId: account.judgeId,
                                })
                              }
                            >
                              <SelectTrigger className="w-[170px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(roleLabels) as RegistryRole[]).map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {roleLabels[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {account.judgeName ? (
                              <Badge variant="outline" className={roleTone.judge}>
                                {account.judgeName}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {account.lastSignInAt ? (
                              new Date(account.lastSignInAt).toLocaleDateString()
                            ) : (
                              <Badge variant="outline">Never</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="text"
                                placeholder="New password"
                                className="h-9 w-[150px]"
                                value={passwordDrafts[account.id] ?? ""}
                                onChange={(e) =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [account.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label="Generate password"
                                onClick={() =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [account.id]: generatePassword(),
                                  }))
                                }
                              >
                                <KeyRound className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  (passwordDrafts[account.id] ?? "").length < 8 ||
                                  changePassword.isPending
                                }
                                onClick={() =>
                                  changePassword.mutate({
                                    userId: account.id,
                                    password: passwordDrafts[account.id] ?? "",
                                  })
                                }
                              >
                                Reset
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Revoke ${account.fullName}`}
                                    disabled={account.id === staff.data?.id}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke this login?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {account.fullName} ({account.email}) will lose access
                                      immediately. Judge records and case data are never deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => revoke.mutate(account.id)}>
                                      Revoke login
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Issue a new login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full name</Label>
                  <Input
                    id="admin-name"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Hon'ble Justice / Registrar name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Official email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="name@court.gov.in"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="admin-password"
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="At least 8 characters"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Generate password"
                      onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy password"
                      disabled={!form.password}
                      onClick={() => void copyToClipboard(form.password)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(role) =>
                      setForm((f) => ({ ...f, role: role as RegistryRole, judgeId: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleLabels) as RegistryRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.role === "judge" && (
                <div className="space-y-2">
                  <Label>Link to judge record</Label>
                  <Select
                    value={form.judgeId}
                    onValueChange={(judgeId) => setForm((f) => ({ ...f, judgeId }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a judge" />
                    </SelectTrigger>
                    <SelectContent>
                      {(judges.data ?? []).map((judge) => (
                        <SelectItem key={judge.id} value={judge.id}>
                          {judge.name}
                          {judge.user_id ? " (already linked)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Bench logins are read-only and scoped to that judge's own listings.
                  </p>
                </div>
              )}

              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !form.email || form.password.length < 8}
              >
                <UserPlus className="size-4" />
                {create.isPending ? "Creating…" : "Create account"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bench" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Judges without a bench login</CardTitle>
            </CardHeader>
            <CardContent>
              {judges.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : unlinkedJudges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every judge on the roll has an active bench login.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {unlinkedJudges.map((judge) => (
                    <li key={judge.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{judge.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {judge.specialisation || "General bench"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            role: "judge",
                            judgeId: judge.id,
                            fullName: judge.name,
                            password: generatePassword(),
                          }));
                          setTab("new");
                        }}
                      >
                        Prepare login
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Judge records themselves are added on the{" "}
                <Link to="/judges" className="underline underline-offset-4">
                  Judges
                </Link>{" "}
                page. Revoking a login never deletes the judge record.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Full name</Label>
            <Input
              id="rename-input"
              value={renaming?.fullName ?? ""}
              onChange={(e) =>
                setRenaming((prev) => (prev ? { ...prev, fullName: e.target.value } : prev))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renaming?.fullName.trim() || rename.isPending}
              onClick={() => renaming && rename.mutate(renaming)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
