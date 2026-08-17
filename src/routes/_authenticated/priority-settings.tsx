import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ConfidenceBar } from "@/components/confidence-bar";
import { casesQuery, type CaseRow } from "@/lib/cases";
import {
  formatSlotLabel,
  runSchedulingEngine,
  schedulingDataQuery,
  type SchedulingWeights,
} from "@/lib/scheduling";
import { ErrorState } from "@/components/states";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  categoryWeightsQuery,
  prioritySettingsQuery,
  recomputeAllPriorities,
  type PrioritySettings,
} from "@/lib/priority";

export const Route = createFileRoute("/_authenticated/priority-settings")({
  head: () => ({
    meta: [
      { title: "Priority scoring settings — NyayaSetu" },
      {
        name: "description",
        content:
          "Adjust category urgency weights and the factor weights used to score case priority.",
      },
      { property: "og:title", content: "Priority scoring settings — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Adjust category urgency weights and the factor weights used to score case priority.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrioritySettingsPage,
});

const numberField = (value: string) => Number(value) || 0;

function PrioritySettingsPage() {
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const settings = useQuery(prioritySettingsQuery);
  const categories = useQuery(categoryWeightsQuery);

  const [form, setForm] = useState<Omit<PrioritySettings, "id"> | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data && !form) {
      const { id: _id, ...rest } = settings.data;
      setForm(rest);
    }
  }, [settings.data, form]);

  useEffect(() => {
    if (categories.data) {
      setWeights((prev) =>
        Object.keys(prev).length
          ? prev
          : Object.fromEntries(categories.data.map((c) => [c.id, String(c.urgency_weight)])),
      );
    }
  }, [categories.data]);

  const isAdmin = staff.data?.role === "admin";

  const save = useMutation({
    mutationFn: async () => {
      if (!form || !settings.data) throw new Error("Settings not loaded yet.");
      const { error } = await supabase
        .from("priority_settings")
        .update(form)
        .eq("id", settings.data.id);
      if (!error)
        await recordAudit("Updated Priority Score settings", "settings:priority_settings");
      if (error) throw error;

      for (const category of categories.data ?? []) {
        const next = Number(weights[category.id]);
        if (Number.isFinite(next) && next !== category.urgency_weight) {
          const { error: catError } = await supabase
            .from("case_categories")
            .update({ urgency_weight: Math.max(0, Math.min(100, Math.round(next))) })
            .eq("id", category.id);
          if (catError) throw catError;
        }
      }
      return recomputeAllPriorities();
    },
    onSuccess: (count) => {
      toast.success(`Settings saved — ${count} case${count === 1 ? "" : "s"} rescored.`);
      queryClient.invalidateQueries({ queryKey: ["priority-settings"] });
      queryClient.invalidateQueries({ queryKey: ["category-weights"] });
      queryClient.invalidateQueries({ queryKey: ["case-categories"] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-engine-data"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalWeight = form
    ? form.category_weight +
      form.pending_weight +
      form.adjournment_weight +
      form.boost_points +
      form.ftsc_pocso_weight +
      form.senior_citizen_weight +
      form.property_dispute_weight +
      form.limitation_deadline_weight
    : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Administration"
        title="Scoring & ranking settings"
        description="Define how each factor contributes to the 0–100 case Priority Score, and how the scheduling engine ranks valid sittings. Changes rescore every case in the registry."
      />

      {!isAdmin && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            These settings are read-only for registrars. Contact an administrator to change scoring
            rules.
          </p>
        </div>
      )}

      {settings.isError ? (
        <ErrorState
          title="Could not load scoring settings"
          error={settings.error}
          onRetry={() => void settings.refetch()}
          retrying={settings.isFetching}
        />
      ) : settings.isLoading || !form ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : (
        <form
          className="mt-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Factor weights</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="w-category">Category urgency (max points)</Label>
                <Input
                  id="w-category"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.category_weight}
                  onChange={(e) =>
                    setForm({ ...form, category_weight: numberField(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-pending">Pending duration (max points)</Label>
                <Input
                  id="w-pending"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.pending_weight}
                  onChange={(e) =>
                    setForm({ ...form, pending_weight: numberField(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-adj">Previous adjournments (max points)</Label>
                <Input
                  id="w-adj"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.adjournment_weight}
                  onChange={(e) =>
                    setForm({ ...form, adjournment_weight: numberField(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-boost">Legal / administrative boost (points)</Label>
                <Input
                  id="w-boost"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.boost_points}
                  onChange={(e) => setForm({ ...form, boost_points: numberField(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap-days">Pending duration cap (days)</Label>
                <Input
                  id="cap-days"
                  type="number"
                  min={1}
                  disabled={!isAdmin}
                  value={form.pending_cap_days}
                  onChange={(e) =>
                    setForm({ ...form, pending_cap_days: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  A case pending this long scores the full weight.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap-adj">Adjournment cap</Label>
                <Input
                  id="cap-adj"
                  type="number"
                  min={1}
                  disabled={!isAdmin}
                  value={form.adjournment_cap}
                  onChange={(e) =>
                    setForm({ ...form, adjournment_cap: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This many adjournments score the full weight.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-workload">Maximum judge workload (active hearings)</Label>
                <Input
                  id="max-workload"
                  type="number"
                  min={1}
                  disabled={!isAdmin}
                  value={form.max_judge_workload}
                  onChange={(e) =>
                    setForm({ ...form, max_judge_workload: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Scheduling is blocked as a conflict once a judge would exceed this many active
                  hearings.
                </p>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Maximum achievable total:{" "}
                <span className="font-medium text-foreground">{totalWeight} pts</span> (scores are
                capped at 100).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statutory priority weights</CardTitle>
              <p className="text-sm text-muted-foreground">
                Points added when the registrar has recorded a statutory category on the case. These
                are never inferred — they come straight from the registration form.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="w-ftsc">Fast Track Special Court / POCSO (points)</Label>
                <Input
                  id="w-ftsc"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.ftsc_pocso_weight}
                  onChange={(e) =>
                    setForm({ ...form, ftsc_pocso_weight: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Centrally-mandated fast-track category — normally the heaviest statutory factor.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-senior">Senior citizen litigant (points)</Label>
                <Input
                  id="w-senior"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.senior_citizen_weight}
                  onChange={(e) =>
                    setForm({ ...form, senior_citizen_weight: numberField(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-property">
                  Property dispute pending 5 years or more (points)
                </Label>
                <Input
                  id="w-property"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.property_dispute_weight}
                  onChange={(e) =>
                    setForm({ ...form, property_dispute_weight: numberField(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-limitation">Statutory limitation deadline (max points)</Label>
                <Input
                  id="w-limitation"
                  type="number"
                  min={0}
                  disabled={!isAdmin}
                  value={form.limitation_deadline_weight}
                  onChange={(e) =>
                    setForm({ ...form, limitation_deadline_weight: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Full points once the deadline is reached or elapsed.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limitation-horizon">Deadline horizon (days)</Label>
                <Input
                  id="limitation-horizon"
                  type="number"
                  min={1}
                  disabled={!isAdmin}
                  value={form.limitation_horizon_days}
                  onChange={(e) =>
                    setForm({ ...form, limitation_horizon_days: numberField(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Points scale up linearly across this many days before the deadline.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Tiers are fixed: <span className="font-medium text-foreground">Tier 1</span> at
                  70+, <span className="font-medium text-foreground">Tier 2</span> at 40–69,{" "}
                  <span className="font-medium text-foreground">Tier 3</span> below 40.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category urgency weights (0–100)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(categories.data ?? []).map((c) => (
                <div key={c.id} className="space-y-2">
                  <Label htmlFor={`cat-${c.id}`}>{c.name}</Label>
                  <Input
                    id={`cat-${c.id}`}
                    type="number"
                    min={0}
                    max={100}
                    disabled={!isAdmin}
                    value={weights[c.id] ?? ""}
                    onChange={(e) => setWeights({ ...weights, [c.id]: e.target.value })}
                  />
                </div>
              ))}
              {(categories.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No case categories defined.</p>
              )}
            </CardContent>
          </Card>

          <SchedulingWeightsCard
            weights={{
              specialisation: form.sched_specialisation_weight,
              workload: form.sched_workload_weight,
              priority: form.sched_priority_weight,
              utilisation: form.sched_utilisation_weight,
            }}
            disabled={!isAdmin}
            onChange={(next) =>
              setForm({
                ...form,
                sched_specialisation_weight: next.specialisation,
                sched_workload_weight: next.workload,
                sched_priority_weight: next.priority,
                sched_utilisation_weight: next.utilisation,
              })
            }
          />

          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving and rescoring…" : "Save and rescore all cases"}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

const WEIGHT_FIELDS: { key: keyof SchedulingWeights; label: string; help: string }[] = [
  {
    key: "specialisation",
    label: "Specialisation match",
    help: "Judge's subject expertise vs the case category.",
  },
  {
    key: "workload",
    label: "Workload balance",
    help: "Favours judges carrying fewer active hearings.",
  },
  {
    key: "priority",
    label: "Priority slot fit",
    help: "Pushes high-priority cases into earlier sittings.",
  },
  {
    key: "utilisation",
    label: "Courtroom utilisation",
    help: "Spreads listings across less-used courtrooms.",
  },
];

/**
 * Admin control over the soft-preference weights the scheduling engine uses to RANK
 * valid options. Hard constraints are never affected — they can only be passed or failed.
 * A live sample case is re-ranked in the browser as the sliders move.
 */
function SchedulingWeightsCard({
  weights,
  disabled,
  onChange,
}: {
  weights: SchedulingWeights;
  disabled: boolean;
  onChange: (next: SchedulingWeights) => void;
}) {
  const engineData = useQuery(schedulingDataQuery);
  const cases = useQuery(casesQuery);
  const [sampleId, setSampleId] = useState("");

  const pending = (cases.data ?? []).filter((c: CaseRow) =>
    ["filed", "adjourned"].includes(c.status),
  );
  const sample = pending.find((c) => c.id === sampleId) ?? pending[0] ?? null;

  const preview =
    sample && engineData.data
      ? runSchedulingEngine(sample, { ...engineData.data, weights }).candidates.slice(0, 3)
      : [];

  const total = weights.specialisation + weights.workload + weights.priority + weights.utilisation;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scheduling engine ranking weights</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {WEIGHT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label>{field.label}</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {weights[field.key]} pts
                </span>
              </div>
              <Slider
                value={[weights[field.key]]}
                min={0}
                max={60}
                step={1}
                disabled={disabled}
                onValueChange={([v]) => onChange({ ...weights, [field.key]: v })}
              />
              <p className="text-xs text-muted-foreground">{field.help}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Total ranking weight: <span className="font-medium text-foreground">{total} pts</span>.
            These weights only rank options that already passed every hard constraint — they can
            never schedule an invalid sitting.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="sample-case">Live effect on a sample case</Label>
            <select
              id="sample-case"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sample?.id ?? ""}
              onChange={(e) => setSampleId(e.target.value)}
            >
              {pending.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} · {c.case_categories?.name ?? "Uncategorised"}
                </option>
              ))}
            </select>
          </div>

          {engineData.isLoading || cases.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !sample ? (
            <p className="text-sm text-muted-foreground">No pending case available to preview.</p>
          ) : preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No valid combination for {sample.case_number} — every option fails a hard constraint.
            </p>
          ) : (
            <ol className="space-y-3">
              {preview.map((c, i) => (
                <li key={c.key} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {i + 1}. {c.judge.name}
                    </p>
                    <span className="text-xs text-muted-foreground">fit {c.score}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.courtroom.name} · {formatSlotLabel(c.slot)}
                  </p>
                  <ConfidenceBar value={c.confidence} className="mt-2" />
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            Re-ranked instantly in this preview. Save to apply the weights across Smart Scheduling,
            case listing and What-If Simulation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
