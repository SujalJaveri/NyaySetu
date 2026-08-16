/**
 * "Why this order" — the legal basis attached to each deterministic priority
 * factor. Nothing here is inferred: every line describes a factor the registrar
 * recorded and the scoring function already computed.
 */
import type { PriorityBreakdown, PriorityFactor } from "@/lib/priority";

export type OrderReason = {
  key: string;
  headline: string;
  basis: string;
  points: number;
  weight: number;
  applies: boolean;
};

const BASIS: Record<string, string> = {
  ftsc_pocso: "Fast Track Special Court priority — centrally mandated category",
  property_dispute:
    "Exceeds the 14th Finance Commission's 5-year fast-track threshold for property disputes",
  senior_citizen: "Established scheduling-priority practice for senior citizen litigants",
  limitation: "Statutory limitation deadline — listing must precede the bar date",
  pending: "Case age — pendency reduction directions",
  adjournments: "Repeat adjournments — cases already deferred are advanced",
  category: "Category urgency weighting set by the registry",
  boost: "Administrative priority direction recorded by an administrator",
};

function headline(f: PriorityFactor): string {
  switch (f.key) {
    case "ftsc_pocso":
      return f.ratio > 0 ? "FTSC / POCSO mandated category" : "Not an FTSC / POCSO matter";
    case "property_dispute":
      return f.ratio > 0
        ? "Property dispute pending 5 years or more"
        : "No long-pending property dispute recorded";
    case "senior_citizen":
      return f.ratio > 0 ? "Senior citizen litigant" : "No senior citizen litigant recorded";
    case "limitation":
      return f.detail;
    case "pending":
      return f.detail;
    default:
      return f.label;
  }
}

export function buildOrderReasons(breakdown: PriorityBreakdown): OrderReason[] {
  return breakdown.factors.map((f) => ({
    key: f.key,
    headline: headline(f),
    basis: BASIS[f.key] ?? f.label,
    points: f.points,
    weight: f.weight,
    applies: f.points > 0,
  }));
}

/** Deterministic text handed to the summariser — it may only be rephrased. */
export function reasonsToPlainText(
  caseNumber: string,
  breakdown: PriorityBreakdown,
  reasons: OrderReason[],
): string {
  const lines = reasons
    .filter((r) => r.applies)
    .map((r) => `- ${r.headline} — ${r.basis} (+${r.points} pts of a maximum ${r.weight})`);
  return [
    `Case ${caseNumber} scored ${breakdown.score} out of 100 and sits in ${breakdown.tier}.`,
    lines.length
      ? "Contributing factors:"
      : "No factor contributed points; the case sits at the base tier.",
    ...lines,
  ].join("\n");
}
