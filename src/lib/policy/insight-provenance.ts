import type { PolicyRegime } from "./regimes";

export function isPolicyInsightCurrent(
  insight: {
    policyId: string | null;
    policyRegime: string | null;
    policyVersionLabel: string | null;
  } | null,
  activePolicy: {
    id: string;
    regime: PolicyRegime;
    versionLabel: string;
  } | null,
) {
  if (!insight || !activePolicy) return false;
  return (
    insight.policyId === activePolicy.id &&
    insight.policyRegime === activePolicy.regime &&
    insight.policyVersionLabel === activePolicy.versionLabel
  );
}