import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Scale,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff, permissionsFor } from "@/hooks/use-current-staff";
import {
  formatSlotLabel,
  schedulingDataQuery,
  slotMinutes,
} from "@/lib/scheduling";
import { conflictDataQuery, detectAssignmentConflicts, type Conflict } from "@/lib/conflicts";
import { recordAudit } from "@/lib/audit";
import type { CaseRow } from "@/lib/cases";
import { MAX_JUDGE_WORKLOAD } from "@/lib/registry";

const DIRECTIVE_PRESETS = [
  "Urgent Mention allowed by Hon'ble Bench",
  "Part-heard matter fixed as per Judge's order",
  "Special Sitting requested by Bench",
  "Date fixed with consent of both counsels",
  "Statutory expeditious disposal directive",
];

export function CustomJudicialScheduleModal({
  caseRow,
  preselectedJudgeId,
  triggerButton,
  onScheduled,
}: {
  caseRow: CaseRow;
  preselectedJudgeId?: string | undefined;
  triggerButton?: React.ReactNode;
  onScheduled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const engineData = useQuery(schedulingDataQuery);
  const conflictData = useQuery(conflictDataQuery);

  const [judgeId, setJudgeId] = useState<string>(preselectedJudgeId ?? "");
  const [courtroomId, setCourtroomId] = useState<string>("");
  const [slotId, setSlotId] = useState<string>("");
  const [directiveReason, setDirectiveReason] = useState<string>(
    DIRECTIVE_PRESETS[0] ?? "Urgent Mention allowed by Hon'ble Bench",
  );
  const [customNote, setCustomNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const judges = engineData.data?.judges ?? [];
  const courtrooms = engineData.data?.courtrooms ?? [];
  const slots = engineData.data?.slots ?? [];

  const selectedJudge = judges.find((j) => j.id === judgeId) ?? null;
  const selectedCourtroom = courtrooms.find((c) => c.id === courtroomId) ?? null;
  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;

  // Real-time pre-flight conflict check on chosen custom values
  const preflightConflicts = useMemo(() => {
    if (!selectedJudge || !selectedCourtroom || !selectedSlot || !conflictData.data) {
      return [] as Conflict[];
    }
    return detectAssignmentConflicts({
      caseNumber: caseRow.case_number,
      caseId: caseRow.id,
      estimatedDurationMinutes: caseRow.estimated_duration_minutes,
      judge: selectedJudge,
      courtroom: selectedCourtroom,
      slot: selectedSlot,
      schedules: conflictData.data.schedules,
      availability: conflictData.data.availability,
      maxJudgeWorkload: conflictData.data.maxJudgeWorkload ?? MAX_JUDGE_WORKLOAD,
    });
  }, [selectedJudge, selectedCourtroom, selectedSlot, caseRow, conflictData.data]);

  const durationFit =
    selectedSlot && (caseRow.estimated_duration_minutes ?? 60) <= slotMinutes(selectedSlot);

  const permissions = permissionsFor(staff.data?.role);
  const canSchedule = permissions.canSchedule || staff.data?.role === "judge";

  async function handleConfirmSchedule() {
    if (!staff.data) {
      toast.error("You must be logged in to record a schedule.");
      return;
    }
    if (!selectedJudge || !selectedCourtroom || !selectedSlot) {
      toast.error("Please select a Judge, Courtroom, and Hearing Slot.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into schedules
      const { data: schedule, error: scheduleError } = await supabase
        .from("schedules")
        .insert({
          case_id: caseRow.id,
          judge_id: selectedJudge.id,
          courtroom_id: selectedCourtroom.id,
          slot_id: selectedSlot.id,
          status: "confirmed",
        })
        .select("id")
        .single();

      if (scheduleError) throw scheduleError;

      // 2. Format detailed judicial directive audit reasoning
      const noteText = customNote.trim() ? ` — Note: ${customNote.trim()}` : "";
      const reasoning = [
        `⚖️ Judicial Directive / Custom Scheduling by ${staff.data.fullName} (${staff.data.role}):`,
        `- Directive Reason: ${directiveReason}${noteText}`,
        `- Presiding Bench: ${selectedJudge.name} (${selectedJudge.specialisation || "General"})`,
        `- Courtroom: ${selectedCourtroom.name} (Cap: ${selectedCourtroom.capacity})`,
        `- Listing Slot: ${formatSlotLabel(selectedSlot)}`,
        `- Case: ${caseRow.case_number} (${caseRow.parties || "Parties on record"})`,
        `- Pre-flight Hard Constraints: ${preflightConflicts.length === 0 ? "PASSED ALL CHECKS" : `OVERRIDDEN (${preflightConflicts.map((c) => c.kind).join(", ")})`}`,
      ].join("\n");

      // 3. Insert recommendation record with status 'modified' (human custom assignment)
      await supabase.from("ai_recommendations").insert({
        schedule_id: schedule.id,
        reasoning,
        status: "modified",
      });

      // 4. Update case status to scheduled
      await supabase.from("cases").update({ status: "scheduled" }).eq("id", caseRow.id);

      // 5. Log audit trail
      await recordAudit(
        `Custom judicial listing confirmed for case ${caseRow.case_number} with ${selectedJudge.name} on ${selectedSlot.date} (${directiveReason})`,
        `case:${caseRow.case_number}`,
      );

      toast.success(`Case ${caseRow.case_number} scheduled per Judicial Directive!`);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-engine-data"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      onScheduled?.();
    } catch (err: any) {
      console.error("Custom schedule error:", err);
      toast.error(err.message || "Failed to confirm custom schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Scale className="size-3.5 text-primary" />
            Custom / Judge's Directive
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Scale className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Custom Judicial Listing</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Schedule case according to specific Judge directive, special sitting, or bench order.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Case snapshot banner */}
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-foreground">{caseRow.case_number}</span>
            <span className="text-muted-foreground ml-2">
              · {caseRow.case_categories?.name ?? "Uncategorised"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{caseRow.estimated_duration_minutes} min est.</span>
            <span>·</span>
            <span>{caseRow.parties || "Parties on record"}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Judge selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Presiding Judge / Bench</Label>
            <Select value={judgeId} onValueChange={(val) => setJudgeId(val)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a judge…" />
              </SelectTrigger>
              <SelectContent>
                {judges.map((j) => (
                  <SelectItem key={j.id} value={j.id} className="text-xs">
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span>{j.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({j.current_workload}/{MAX_JUDGE_WORKLOAD})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Courtroom selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Courtroom / Hall</Label>
            <Select value={courtroomId} onValueChange={(val) => setCourtroomId(val)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a courtroom…" />
              </SelectTrigger>
              <SelectContent>
                {courtrooms.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name} (Cap: {c.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slot selection */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Hearing Date & Time Slot</Label>
            <Select value={slotId} onValueChange={(val) => setSlotId(val)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Choose a published hearing slot…" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {slots.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {formatSlotLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Directive Reason Preset */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Judicial Directive / Reason</Label>
            <Select value={directiveReason} onValueChange={(val) => setDirectiveReason(val)}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIVE_PRESETS.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional notes */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Additional Bench Note (Optional)</Label>
            <Textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. As directed in Court Room 3 during morning mentions; to be taken up at 10:30 AM sharp."
              className="text-xs h-16 resize-none"
            />
          </div>
        </div>

        {/* Live Pre-Flight Conflict Checks */}
        {selectedJudge && selectedCourtroom && selectedSlot && (
          <div className="rounded-md border border-border bg-card p-3 space-y-2 text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Pre-Flight Validation for Custom Selection
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                {preflightConflicts.some((c) => c.kind.includes("judge")) ? (
                  <XCircle className="size-3.5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                )}
                <span>Judge availability & load</span>
              </div>
              <div className="flex items-center gap-1.5">
                {preflightConflicts.some((c) => c.kind.includes("courtroom")) ? (
                  <XCircle className="size-3.5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                )}
                <span>Courtroom availability</span>
              </div>
              <div className="flex items-center gap-1.5">
                {preflightConflicts.some((c) => c.kind === "slot_occupied") ? (
                  <XCircle className="size-3.5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                )}
                <span>Slot booking clash</span>
              </div>
              <div className="flex items-center gap-1.5">
                {durationFit ? (
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                ) : (
                  <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                )}
                <span>Duration fit ({caseRow.estimated_duration_minutes}m)</span>
              </div>
            </div>

            {preflightConflicts.length > 0 && (
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                <p className="font-semibold">⚠️ Potential Conflict Warning:</p>
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {preflightConflicts.map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] opacity-80">
                  Judicial override will log this warning along with your stated directive reason in
                  the permanent audit trail.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmSchedule}
            disabled={!selectedJudge || !selectedCourtroom || !selectedSlot || submitting || !canSchedule}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCheck className="size-4" />
            )}
            Confirm & Schedule per Directive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
