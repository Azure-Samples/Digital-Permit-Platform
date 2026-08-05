// ─────────────────────────────────────────────────────────────
// Module registry types
// ─────────────────────────────────────────────────────────────

/** Field types supported by the dynamic form builder */
export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "checkbox"
  | "select"
  | "radio"
  | "postcode"
  | "address"
  | "number"
  | "currency"
  | "upload"
  | "email"
  | "phone"
  | "repeatable";

/** A single field in a form section */
export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: SelectOption[]; // for select / radio
  conditionalOn?: ConditionalRule;
  repeatableSchema?: FormField[]; // for repeatable sections
  maxRepeats?: number;
  defaultValue?: unknown;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** A section in the multi-step form wizard */
export interface FormSection {
  key: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditionalOn?: ConditionalRule;
}

/** Conditional display / requirement rules */
export interface ConditionalRule {
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "contains" | "exists";
  value: unknown;
}

/** Document requirement definition */
export interface DocumentRequirement {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  conditionalOn?: ConditionalRule;
  acceptedMimeTypes?: string[];
  maxSizeMb?: number;
  verificationStatus: "verified_public_page" | "verified_form_pack" | "verified_policy" | "needs_council_confirmation";
}

/** Workflow stage definition */
export interface WorkflowStage {
  key: string;
  label: string;
  order: number;
  type: "validation" | "review" | "inspection" | "consultation" | "hearing" | "training" | "decision" | "custom";
  slaBusinessDays?: number;
  reminderDays?: number;
  autoTransitions?: AutoTransition[];
  requiredActions?: string[];
  visibleToApplicant?: boolean;
}

export interface AutoTransition {
  condition: string; // e.g. "all_documents_verified"
  toStage: string;
}

/** Checklist item for case review */
export interface ChecklistItem {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  category?: string;
}

/** Fee schedule */
export interface FeeSchedule {
  [applicationType: string]: number | FeeRule;
}

export interface FeeRule {
  baseAmount: number;
  bands?: FeeBand[];
}

export interface FeeBand {
  label: string;
  condition: ConditionalRule;
  amount: number;
}

/** Eligibility rule */
export interface EligibilityRule {
  field: string;
  operator: "eq" | "neq" | "gte" | "lte" | "in";
  value: unknown;
  message: string;
}

/** Retention policy */
export interface RetentionPolicy {
  retentionMonths: number;
  deleteDocumentsAfterMonths?: number;
  anonymiseAfterMonths?: number;
}

/** Decision templates */
export interface DecisionTemplates {
  approve?: string;
  refuse?: string;
  conditions?: string;
}

/** Notification template */
export interface NotificationTemplate {
  key: string;
  channel: "email" | "in_app";
  subject: string;
  bodyTemplate: string; // supports {{variable}} placeholders
  trigger: string; // e.g. "on_submit", "on_approve", "sla_warning"
}
