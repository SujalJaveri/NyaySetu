/**
 * Predictive Intelligence Module for NyayaSetu.
 *
 * Implements "Predict-then-Optimize" features:
 * 1. Hearing Duration Predictor: Estimates realistic hearing minutes from case archetype,
 *    pendency age, and procedural history.
 * 2. Adjournment Risk Forecaster: Predicts probability (0–100%) that a listed matter
 *    will collapse or seek deferral, allowing optimal cause list over-booking / slotting.
 */

export type DurationPrediction = {
  predictedMinutes: number;
  baseCategoryMinutes: number;
  confidence: number;
  factors: {
    label: string;
    impactMinutes: number;
    reason: string;
  }[];
};

export type AdjournmentRisk = {
  riskPercentage: number;
  tier: "Low" | "Moderate" | "High";
  keyDrivers: string[];
};

export type CasePredictionInput = {
  categoryName?: string | null;
  baseDuration?: number | null;
  pendingDays: number;
  previousAdjournments: number;
  isFtscPocso?: boolean;
  isSeniorCitizen?: boolean;
  isPropertyDispute5yr?: boolean;
  partiesCount?: number;
};

/**
 * Predicts realistic hearing duration in minutes.
 */
export function predictHearingDuration(input: CasePredictionInput): DurationPrediction {
  const base = Math.max(15, input.baseDuration || 60);
  let adjustment = 0;
  const factors: DurationPrediction["factors"] = [];

  // 1. Age factor (Cases pending > 2 years accumulate voluminous evidence & multi-bench history)
  if (input.pendingDays > 730) {
    const ageImpact = Math.round(base * 0.25);
    adjustment += ageImpact;
    factors.push({
      label: "Voluminous Record / Age Factor",
      impactMinutes: ageImpact,
      reason: `Case has been pending for ${(input.pendingDays / 365).toFixed(1)} years`,
    });
  } else if (input.pendingDays > 365) {
    const ageImpact = Math.round(base * 0.12);
    adjustment += ageImpact;
    factors.push({
      label: "Age Adjustment",
      impactMinutes: ageImpact,
      reason: "Case pending over 1 year",
    });
  }

  // 2. Repeat adjournment history (indicates complex procedural hurdles or witness issues)
  if (input.previousAdjournments >= 3) {
    const adjImpact = Math.round(base * 0.2);
    adjustment += adjImpact;
    factors.push({
      label: "Procedural Complexity",
      impactMinutes: adjImpact,
      reason: `${input.previousAdjournments} prior adjournments recorded`,
    });
  }

  // 3. FTSC / POCSO expedited trial requirements
  if (input.isFtscPocso) {
    const pocsoImpact = 20;
    adjustment += pocsoImpact;
    factors.push({
      label: "FTSC / POCSO Protocol",
      impactMinutes: pocsoImpact,
      reason: "In-camera statutory child / witness examination protocol",
    });
  }

  // 4. Multiple parties factor
  if (input.partiesCount && input.partiesCount > 2) {
    const multiPartyImpact = (input.partiesCount - 2) * 5;
    adjustment += multiPartyImpact;
    factors.push({
      label: "Multi-Party Hearing",
      impactMinutes: multiPartyImpact,
      reason: `${input.partiesCount} parties on record requires joint counsel hearing`,
    });
  }

  const predicted = Math.min(180, Math.max(15, base + adjustment));
  const confidence = Math.max(65, Math.min(95, 88 - input.previousAdjournments * 4));

  return {
    predictedMinutes: predicted,
    baseCategoryMinutes: base,
    confidence,
    factors,
  };
}

/**
 * Computes the Adjournment Risk Score (0–100%).
 */
export function computeAdjournmentRisk(input: CasePredictionInput): AdjournmentRisk {
  let score = 15; // baseline court adjournment probability (~15%)
  const drivers: string[] = [];

  // Factor 1: Repeat past adjournments is the highest predictor of future adjournment
  if (input.previousAdjournments >= 3) {
    score += 45;
    drivers.push(`High historical deferrals (${input.previousAdjournments} prior adjournments)`);
  } else if (input.previousAdjournments === 2) {
    score += 28;
    drivers.push("Multiple prior adjournments recorded");
  } else if (input.previousAdjournments === 1) {
    score += 12;
    drivers.push("One prior adjournment recorded");
  }

  // Factor 2: Case Age / Inactive file
  if (input.pendingDays > 1000) {
    score += 18;
    drivers.push("Long-pending legacy matter (> 3 years)");
  }

  // Factor 3: Multi-party representation clashes
  if (input.partiesCount && input.partiesCount > 3) {
    score += 15;
    drivers.push(`${input.partiesCount} parties increase risk of counsel absence`);
  }

  // Mitigating Factor: FTSC / POCSO statutory mandate reduces adjournment likelihood
  if (input.isFtscPocso) {
    score = Math.max(5, score - 25);
    drivers.push("FTSC statutory bar on unnecessary adjournments");
  }

  const finalScore = Math.min(95, Math.max(5, score));
  const tier: AdjournmentRisk["tier"] =
    finalScore >= 60 ? "High" : finalScore >= 30 ? "Moderate" : "Low";

  return {
    riskPercentage: Math.round(finalScore),
    tier,
    keyDrivers: drivers.length > 0 ? drivers : ["Standard routine hearing progression"],
  };
}
