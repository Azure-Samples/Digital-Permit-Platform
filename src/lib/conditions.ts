// ─────────────────────────────────────────────────────────────
// Conditional logic evaluator for dynamic forms
// ─────────────────────────────────────────────────────────────
import type { ConditionalRule } from "@/types/module";

/**
 * Evaluate a conditional rule against form answers.
 */
export function evaluateCondition(
  rule: ConditionalRule,
  answers: Record<string, unknown>
): boolean {
  const fieldValue = answers[rule.field];

  switch (rule.operator) {
    case "eq":
      return fieldValue === rule.value;

    case "neq":
      return fieldValue !== rule.value;

    case "in":
      if (Array.isArray(rule.value)) {
        return rule.value.includes(fieldValue);
      }
      return false;

    case "not_in":
      if (Array.isArray(rule.value)) {
        return !rule.value.includes(fieldValue);
      }
      return true;

    case "gt":
      return typeof fieldValue === "number" && typeof rule.value === "number"
        ? fieldValue > rule.value
        : false;

    case "lt":
      return typeof fieldValue === "number" && typeof rule.value === "number"
        ? fieldValue < rule.value
        : false;

    case "contains":
      if (typeof fieldValue === "string" && typeof rule.value === "string") {
        return fieldValue.toLowerCase().includes(rule.value.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(rule.value);
      }
      return false;

    case "exists":
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";

    default:
      return true;
  }
}

/**
 * Determine which fields are visible given current answers.
 */
export function getVisibleFields(
  fields: Array<{ key: string; conditionalOn?: ConditionalRule }>,
  answers: Record<string, unknown>
): string[] {
  return fields
    .filter((field) => {
      if (!field.conditionalOn) return true;
      return evaluateCondition(field.conditionalOn, answers);
    })
    .map((f) => f.key);
}

/**
 * Determine which document requirements apply given current answers.
 */
export function getRequiredDocuments(
  requirements: Array<{
    key: string;
    required: boolean;
    conditionalOn?: ConditionalRule;
  }>,
  answers: Record<string, unknown>
): Array<{ key: string; required: boolean }> {
  return requirements
    .filter((req) => {
      if (!req.conditionalOn) return true;
      return evaluateCondition(req.conditionalOn, answers);
    })
    .map(({ key, required }) => ({ key, required }));
}
