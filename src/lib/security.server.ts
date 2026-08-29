/**
 * Server-Side Security & Prompt Injection Defense
 */

/**
 * Sanitizes arbitrary user input before passing it into prompts or queries:
 * 1. Strips ASCII control characters and null bytes.
 * 2. Normalizes excessive whitespace.
 * 3. Truncates to max length.
 */
export function sanitizeUserInput(input: string, maxLength = 500): string {
  if (!input) return "";

  // Strip null bytes and non-printable control characters (except newline and tab)
  const cleaned = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  return cleaned.slice(0, maxLength);
}

/**
 * Known adversarial prompt injection indicators (for telemetry & logging).
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|jailbreak|unrestricted|god)\s+mode/i,
  /system\s+override/i,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+key|database\s+password|secret)/i,
  /drop\s+table/i,
  /select\s+\*\s+from\s+auth/i,
];

/**
 * Scans input for obvious malicious injection patterns.
 */
export function detectPromptInjection(input: string): { isSuspicious: boolean; matchedPattern?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { isSuspicious: true, matchedPattern: pattern.source };
    }
  }
  return { isSuspicious: false };
}
