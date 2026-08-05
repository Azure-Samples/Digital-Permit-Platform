// ─────────────────────────────────────────────────────────────
// Shared types for the Policy AI feature
// ─────────────────────────────────────────────────────────────

/** RAG rating plus a neutral "na" state for matters outside the policy's scope. */
export type RagRating = "green" | "amber" | "red" | "na";

/** A single authorised licensable activity with its permitted hours. */
export interface LicensableActivityItem {
  activity: string; // e.g. "Sale of alcohol (on and off the premises)"
  days?: string; // e.g. "Monday to Sunday"
  hours?: string; // e.g. "10:00 – 23:00"
}

/** One licence condition extracted from the document. */
export interface LicenceConditionItem {
  text: string;
  source?: string; // e.g. "Operating schedule", "Police", "Environmental Health"
}

/** Mandatory condition presence check (the 6 statutory conditions). */
export interface MandatoryConditionCheck {
  condition: string; // short name, e.g. "Age verification policy (Challenge 25)"
  present: boolean;
  note?: string;
}

/** Risk flagged against one of the four licensing objectives. */
export interface ObjectiveRisk {
  objective: string; // one of the four licensing objectives
  level: RagRating;
  note: string;
}

/** Structured, at-a-glance extract of a licence document. */
export interface LicenceSummary {
  documentType: string; // e.g. "Premises Licence"
  licenceNumber?: string;
  atAGlance: string; // 2–3 sentence plain-English overview
  licenceHolder?: string;
  premisesName?: string;
  premisesAddress?: string;
  designatedPremisesSupervisor?: {
    name?: string;
    personalLicenceNumber?: string;
  };
  licensableActivities: LicensableActivityItem[];
  openingHours?: string;
  mandatoryConditions: MandatoryConditionCheck[];
  operatingScheduleConditions: LicenceConditionItem[];
  responsibleAuthorityConditions: LicenceConditionItem[];
  objectiveRisks: ObjectiveRisk[];
  officerActions: string[]; // suggested things an officer/police should check
}

/** One line of a policy-compliance assessment. */
export interface ComplianceCheck {
  area: string; // e.g. "Cumulative Impact Area"
  rating: RagRating;
  finding: string; // plain-English explanation
  policyRef?: string; // e.g. "5.3"
}

/** Overall compliance assessment of a licence / application vs the policy. */
export interface ComplianceAssessment {
  overall: RagRating;
  overallLabel: string; // e.g. "Consistent with policy"
  headline: string; // 1–2 sentence summary for the officer
  checks: ComplianceCheck[];
  recommendations: string[];
}

/** A policy citation surfaced with a chat answer. */
export interface Citation {
  ref: string;
  heading: string;
}
