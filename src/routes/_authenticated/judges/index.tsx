import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { WorkloadMeter } from "@/components/registry-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { recordAudit } from "@/lib/audit";
import { createBenchLogin } from "@/lib/bench-accounts.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  benchAccountsQuery,
  countBy,
  isActive,
  judgesQuery,
  schedulesQuery,
  type Judge,
} from "@/lib/registry";

export const Route = createFileRoute("/_authenticated/judges/")({
  head: () => ({
    meta: [
      { title: "Judges — NyayaSetu" },
      {
        name: "description",
        content: "Judicial officers, their specialisations, sitting workload and assigned cases.",
      },
      { property: "og:title", content: "Judges — NyayaSetu" },
      {
        property: "og:description",
        content: "Judicial officers, their specialisations, sitting workload and assigned cases.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JudgesPage,
});

function JudgesPage() {
  const queryClient = useQueryClient();
  const { data: staff } = useCurrentStaff();
  const isAdmin = staff?.role === "admin";

  const judges = useQuery(judgesQuery);
  const schedules = useQuery(schedulesQuery);
  const benchAccounts = useQuery({ ...benchAccountsQuery, enabled: isAdmin });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Judge | null>(null);
  const [name, setName] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [workload, setWorkload] = useState("0");
  const [benchAccount, setBenchAccount] = useState<string>("none");
  const [deleting, setDeleting] = useState<Judge | null>(null);
  const [loginFor, setLoginFor] = useState<Judge | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const issueLogin = useMutation({
    mutationFn: async () => {
      if (!loginFor) return;
      await createBenchLogin({
        data: {
          judgeId: loginFor.id,
          email: loginEmail,
          password: loginPassword,
          fullName: loginFor.name,
        },
      });
      await recordAudit(`Issued a bench login for ${loginFor.name}`, `judge:${loginFor.name}`);
    },
    onSuccess: () => {
      toast.success("Bench login issued.");
      setLoginFor(null);
      setLoginEmail("");
      setLoginPassword("");
      queryClient.invalidateQueries({ queryKey: ["judges"] });
      queryClient.invalidateQueries({ queryKey: ["bench-accounts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const caseCounts = useMemo(
    () =>
      countBy(
        (schedules.data ?? []).filter((s) => isActive(s.status)),
        (s) => s.judge_id,
      ),
    [schedules.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = judges.data ?? [];
    if (!q) return list;
    return list.filter(
      (j) => j.name.toLowerCase().includes(q) || (j.specialisation ?? "").toLowerCase().includes(q),
    );
  }, [judges.data, search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setSpecialisation("");
    setWorkload("0");
    setBenchAccount("none");
    setFormOpen(true);
  }

  function openEdit(judge: Judge) {
    setEditing(judge);
    setName(judge.name);
    setSpecialisation(judge.specialisation ?? "");
    setWorkload(String(judge.current_workload ?? 0));
    setBenchAccount(judge.user_id ?? "none");
    setFormOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        specialisation: specialisation.trim(),
        current_workload: Number(workload) || 0,
        user_id: benchAccount === "none" ? null : benchAccount,
      };
      if (!payload.name) throw new Error("Name is required.");
      const { error } = editing
        ? await supabase.from("judges").update(payload).eq("id", editing.id)
        : await supabase.from("judges").insert(payload);
      if (error) throw error;
      await recordAudit(
        `${editing ? "Updated" : "Added"} judge ${payload.name}`,
        `judge:${payload.name}`,
      );
    },
    onSuccess: () => {
      toast.success(editing ? "Judge updated." : "Judge added.");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["judges"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (judge: Judge) => {
      const { error } = await supabase.from("judges").delete().eq("id", judge.id);
      if (error) throw error;
      await recordAudit(`Removed judge ${judge.name}`, `judge:${judge.name}`);
    },
    onSuccess: () => {
      toast.success("Judge removed.");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["judges"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="People"
        title="Judges"
        description="Judicial officers, their specialisations, sitting workload and assigned cases."
        actions={
          staff?.role === "judge" ? undefined : (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                onClick={openCreate}
                disabled={!isAdmin}
                title={
                  isAdmin ? undefined : "Only registry administrators can add judicial officers."
                }
              >
                <Plus className="size-4" /> Add Judge
              </Button>
              {!isAdmin && (
                <span className="text-xs text-muted-foreground">Administrator access required</span>
              )}
            </div>
          )
        }
      />

      <div className="mt-6 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or specialisation"
            className="pl-9"
            aria-label="Search judges"
          />
        </div>
        <span className="text-sm text-muted-foreground">{rows.length} listed</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialisation</TableHead>
              <TableHead>Current workload</TableHead>
              <TableHead className="text-right">Assigned cases</TableHead>
              {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {judges.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={isAdmin ? 5 : 4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {judges.isError && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="py-10 text-center text-sm text-destructive"
                >
                  Could not load judges.
                </TableCell>
              </TableRow>
            )}

            {!judges.isLoading && !judges.isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="py-14 text-center">
                  <Gavel className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No judges found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {search
                      ? "Try a different search term."
                      : "Add the first judicial officer to begin."}
                  </p>
                </TableCell>
              </TableRow>
            )}

            {rows.map((judge) => (
              <TableRow key={judge.id} className="hover:bg-muted/50">
                <TableCell>
                  <Link
                    to="/judges/$judgeId"
                    params={{ judgeId: judge.id }}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {judge.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {judge.specialisation ? (
                    <Badge variant="secondary">{judge.specialisation}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <WorkloadMeter value={judge.current_workload ?? 0} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {caseCounts.get(judge.id) ?? 0}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Issue bench login"
                      title={judge.user_id ? "Bench login already linked" : "Issue bench login"}
                      disabled={!!judge.user_id}
                      onClick={() => {
                        setLoginFor(judge);
                        setLoginEmail("");
                        setLoginPassword("");
                      }}
                    >
                      <KeyRound className={judge.user_id ? "size-4 text-primary" : "size-4"} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit judge"
                      onClick={() => openEdit(judge)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete judge"
                      onClick={() => setDeleting(judge)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!loginFor} onOpenChange={(open) => !open && setLoginFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue bench login</DialogTitle>
            <DialogDescription>
              Creates a judge account for {loginFor?.name}. Bench accounts are read-only and can
              only see their own listings, cause list and workload.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              issueLogin.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="bench-email">Official email</Label>
              <Input
                id="bench-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@courts.gov"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bench-password">Temporary password</Label>
              <Input
                id="bench-password"
                type="text"
                required
                minLength={8}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoginFor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={issueLogin.isPending}>
                {issueLogin.isPending ? "Creating…" : "Create login"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit judge" : "Add judge"}</DialogTitle>
            <DialogDescription>
              Record the judicial officer's name, bench specialisation and current sitting workload.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="judge-name">Name</Label>
              <Input
                id="judge-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="judge-spec">Specialisation</Label>
              <Input
                id="judge-spec"
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value)}
                placeholder="e.g. Criminal, Civil, Family"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="judge-account">Bench login account</Label>
              <Select value={benchAccount} onValueChange={setBenchAccount}>
                <SelectTrigger id="judge-account">
                  <SelectValue placeholder="Not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {(benchAccounts.data ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking gives this judge a read-only view of their own listings, cause list and
                workload — and nothing else.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="judge-workload">Current workload (active cases)</Label>
              <Input
                id="judge-workload"
                type="number"
                min={0}
                value={workload}
                onChange={(e) => setWorkload(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save changes" : "Add judge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the judge from the registry. Existing schedules will be left without an
              assigned judge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
