// ─────────────────────────────────────────────────────────────
// External API answer validation
// ─────────────────────────────────────────────────────────────
// Validates submitted answers against a module version's form
// schema at the trust boundary. Honours conditional visibility so
// hidden fields are neither required nor validated. Document upload
// fields are validated separately (out of scope for this API).
// ─────────────────────────────────────────────────────────────
import type { FormField, FormSection } from "@/types/module";
import { evaluateCondition } from "../conditions";

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldError[];
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function flatten(
  sections: FormSection[],
  answers: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const section of sections) {
    const sectionAnswers = answers[section.key] ?? {};
    for (const field of section.fields) {
      if (field.key in sectionAnswers) flat[field.key] = sectionAnswers[field.key];
    }
  }
  return flat;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateValue(field: FormField, value: unknown, context: Record<string, unknown> = {}): string | null {
  switch (field.type) {
    case "number":
    case "currency": {
      const numeric = toNumber(value);
      if (numeric === null) return `${field.label} must be a number.`;
      if (field.validation?.min !== undefined && numeric < field.validation.min)
        return `${field.label} must be at least ${field.validation.min}.`;
      if (field.validation?.max !== undefined && numeric > field.validation.max)
        return `${field.label} must be at most ${field.validation.max}.`;
      return null;
    }
    case "checkbox":
      if (field.required && value !== true) return `${field.label} must be confirmed.`;
      return typeof value === "boolean"
        ? null
        : `${field.label} must be true or false.`;
    case "email":
      return typeof value === "string" && EMAIL_PATTERN.test(value)
        ? null
        : `${field.label} must be a valid email address.`;
    case "select":
    case "radio": {
      const allowed = (field.options ?? []).map((option) => option.value);
      return allowed.includes(String(value))
        ? null
        : `${field.label} must be one of the allowed options.`;
    }
    case "date": {
      const date = String(value);
      const parsed = new Date(date);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? null : `${field.label} must be a valid date.`;
    }
    case "address": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return `${field.label} must be an address.`;
      const address = value as Record<string, unknown>;
      if (Object.values(address).some((part) => typeof part !== "string")) return `${field.label} must contain text address lines.`;
      if (field.required && ["line1", "town", "postcode"].some((part) => typeof address[part] !== "string" || !String(address[part]).trim())) return `${field.label} needs an address line, town and postcode.`;
      return null;
    }
    case "repeatable": {
      if (!Array.isArray(value)) return `${field.label} must be a list.`;
      if (field.maxRepeats !== undefined && value.length > field.maxRepeats)
        return `${field.label} allows at most ${field.maxRepeats} entries.`;
      if (field.required && !value.length) return `${field.label} needs at least one entry.`;
      for (const entry of value) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return `${field.label} contains an invalid entry.`;
        const answers = { ...context, ...entry };
        for (const child of field.repeatableSchema ?? []) {
          if (child.conditionalOn && !evaluateCondition(child.conditionalOn, answers)) continue;
          const answer = entry[child.key];
          const empty = answer === undefined || answer === null || (typeof answer === "string" && !answer.trim());
          if (empty && child.required) return `${field.label}: ${child.label} is required.`;
          if (!empty) {
            const message = validateValue(child, answer, answers);
            if (message) return `${field.label}: ${message}`;
          }
        }
      }
      return null;
    }
    default: {
      // text, textarea, postcode, address, phone
      if (typeof value !== "string") return `${field.label} must be text.`;
      const { minLength, maxLength, pattern, patternMessage } =
        field.validation ?? {};
      if (minLength !== undefined && value.length < minLength)
        return `${field.label} must be at least ${minLength} characters.`;
      if (maxLength !== undefined && value.length > maxLength)
        return `${field.label} must be at most ${maxLength} characters.`;
      if (pattern) {
        try {
          if (!new RegExp(pattern).test(value))
            return patternMessage ?? `${field.label} is not in the expected format.`;
        } catch {
          // A malformed schema pattern must never crash validation.
        }
      }
      return null;
    }
  }
}

/**
 * Validate answers against the form schema.
 * With `partial: true`, missing required fields are tolerated (draft save);
 * provided values are always validated.
 */
export function validateAnswers(
  sections: FormSection[],
  answers: Record<string, Record<string, unknown>>,
  options: { partial?: boolean; contextAnswers?: Record<string, unknown> } = {},
): ValidationResult {
  const errors: FieldError[] = [];
  const flat = { ...options.contextAnswers, ...flatten(sections, answers) };

  for (const section of sections) {
    if (section.conditionalOn && !evaluateCondition(section.conditionalOn, flat)) {
      continue;
    }
    const sectionAnswers = answers[section.key] ?? {};
    for (const field of section.fields) {
      if (field.conditionalOn && !evaluateCondition(field.conditionalOn, flat)) {
        continue;
      }
      const value = sectionAnswers[field.key];
      const empty = value === undefined || value === null || (typeof value === "string" && !value.trim());

      if (empty) {
        // Uploads are satisfied by documents, not answers.
        if (field.required && !options.partial && field.type !== "upload") {
          errors.push({ field: field.key, message: `${field.label} is required.` });
        }
        continue;
      }

      if (field.type === "upload") continue;
      const message = validateValue(field, value, flat);
      if (message) errors.push({ field: field.key, message });
    }
  }

  return { ok: errors.length === 0, errors };
}
