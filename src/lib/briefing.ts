/**
 * "Today's Priorities" briefing.
 *
 * This is a deterministic sentence-template generator: it reads real counts
 * already computed for the Dashboard and plugs them into fixed phrasing. No
 * model call, no network, no non-determinism — it always renders in a demo.
 *
 * The generator is isolated behind the `BriefingGenerator` interface below so
 * an LLM-backed implementation can replace `deterministicBriefing` later
 * without touching the Dashboard: build the same `BriefingInput`, return the
 * same `Briefing`.
 */
import type { FlaggedConflict } from "@/lib/conflicts";
import { caseTier, type DashboardData, type DashboardMetrics } from "@/lib/dashboard";

export type BriefingInput = {
  /** Open (non-disposed) cases. */
  pendingCases: number;
  /** Open cases with a Priority Score of 70 or above. */
  highPriorityCases: number;
  /** Open cases with no active listing. */
  awaitingScheduling: number;
  /** High-priority open cases with no active listing. */
  highPriorityAwaiting: number;
  /** Active (proposed or confirmed) listings. */
  scheduledHearings: number;
  /** Active listings falling on today's date. */
  hearingsToday: number;
  /** Active listings in the next seven days, today included. */
  hearingsThisWeek: number;
  /** Unresolved hard-constraint violations from Conflict Detection. */
  conflicts: number;
  /** Judges at or above 80% of the configured workload threshold. */
  judgesNearCapacity: number;
  /** Names of those judges, registry order. */
  judgesNearCapacityNames: string[];
  judgeUtilisation: number;
  courtroomUtilisation: number;
  totalJudges: number;
  maxJudgeWorkload: number;
};

export type Briefing = {
  /** 2–4 sentences of plain language, newest facts first. */
  sentences: string[];
  /** Where the numbers came from, so the panel never reads as an opaque claim. */
  source: string;
};

export type BriefingGenerator = (input: BriefingInput) => Promise<Briefing>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const listNames = (names: string[]) => {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} other${names.length - 2 === 1 ? "" : "s"}`;
};

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Collapses live Dashboard data into the flat fact set the templates read. */
export function buildBriefingInput(
  data: DashboardData,
  metrics: DashboardMetrics,
  conflicts: FlaggedConflict[],
  today = new Date(),
): BriefingInput {
  const todayKey = toDateKey(today);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndKey = toDateKey(weekEnd);

  const activeScheduled = data.schedules.filter(
    (s) => s.status === "proposed" || s.status === "confirmed",
  );
  const scheduledCaseIds = new Set(activeScheduled.map((s) => s.case_id));

  const openCases = data.cases.filter((c) => c.status !== "disposed");
  const highPriorityAwaiting = openCases.filter(
    (c) => caseTier(c) === "Tier 1" && !scheduledCaseIds.has(c.id),
  ).length;

  const nearCapacity = metrics.judgeWorkload.filter(
    (j) => j.capacity > 0 && j.hearings / j.capacity >= 0.8,
  );

  return {
    pendingCases: metrics.pendingCases,
    highPriorityCases: metrics.highPriorityCases,
    awaitingScheduling: metrics.awaitingScheduling,
    highPriorityAwaiting,
    scheduledHearings: metrics.scheduledHearings,
    hearingsToday: activeScheduled.filter((s) => s.slot?.date === todayKey).length,
    hearingsThisWeek: activeScheduled.filter(
      (s) => s.slot?.date && s.slot.date >= todayKey && s.slot.date <= weekEndKey,
    ).length,
    conflicts: conflicts.length,
    judgesNearCapacity: nearCapacity.length,
    judgesNearCapacityNames: nearCapacity.map((j) => j.name),
    judgeUtilisation: metrics.judgeUtilisation,
    courtroomUtilisation: metrics.courtroomUtilisation,
    totalJudges: metrics.judgeWorkload.length,
    maxJudgeWorkload: data.maxJudgeWorkload,
  };
}

/** Builds the briefing sentences. Pure and synchronous — safe to unit test. */
export function composeBriefingSentences(i: BriefingInput): string[] {
  const sentences: string[] = [];

  // 1. Caseload and what still needs a listing.
  if (i.pendingCases === 0) {
    sentences.push(
      "There are no open cases on the registry right now — every case on file has been disposed.",
    );
  } else if (i.awaitingScheduling === 0) {
    sentences.push(
      `All ${plural(i.pendingCases, "open case")} currently have an active listing, including ${plural(i.highPriorityCases, "Tier 1 case")}.`,
    );
  } else {
    const highPart = i.highPriorityAwaiting > 0 ? `, ${i.highPriorityAwaiting} of them Tier 1` : "";
    sentences.push(
      `${plural(i.awaitingScheduling, "case")} of ${i.pendingCases} open are awaiting scheduling${highPart}.`,
    );
  }

  // 2. Bench pressure this week.
  if (i.judgesNearCapacity > 0) {
    sentences.push(
      `${plural(i.judgesNearCapacity, "judge")} ${i.judgesNearCapacity === 1 ? "is" : "are"} near capacity against the ${i.maxJudgeWorkload}-hearing threshold (${listNames(i.judgesNearCapacityNames)}), with the bench running at ${i.judgeUtilisation}% utilisation.`,
    );
  } else if (i.totalJudges > 0) {
    sentences.push(
      `No judge is near the ${i.maxJudgeWorkload}-hearing threshold — the bench is at ${i.judgeUtilisation}% utilisation and courtrooms at ${i.courtroomUtilisation}%.`,
    );
  }

  // 3. Conflicts — the item that most needs a human decision.
  if (i.conflicts > 0) {
    sentences.push(
      `${plural(i.conflicts, "unresolved conflict")} ${i.conflicts === 1 ? "needs" : "need"} attention before those listings can be confirmed.`,
    );
  } else {
    sentences.push("Conflict Detection reports no unresolved hard-constraint violations.");
  }

  // 4. The day ahead.
  if (i.hearingsToday > 0) {
    sentences.push(
      `${plural(i.hearingsToday, "hearing")} ${i.hearingsToday === 1 ? "is" : "are"} listed for today and ${i.hearingsThisWeek} across the next seven days.`,
    );
  } else if (i.hearingsThisWeek > 0) {
    sentences.push(
      `Nothing is listed for today; ${plural(i.hearingsThisWeek, "hearing")} ${i.hearingsThisWeek === 1 ? "falls" : "fall"} within the next seven days.`,
    );
  }

  return sentences.slice(0, 4);
}

/**
 * Default generator: deterministic templates only. Async purely so the
 * signature already matches a future model-backed generator.
 */
export const deterministicBriefing: BriefingGenerator = async (input) => ({
  sentences: composeBriefingSentences(input),
  source:
    "Composed from live case, schedule, availability and conflict records — fixed wording, no model call.",
});

/** Swap point: assign a different generator here to move to an LLM later. */
export const briefingGenerator: BriefingGenerator = deterministicBriefing;

export const briefingQueryKey = (input: BriefingInput) => ["dashboard", "briefing", input] as const;
