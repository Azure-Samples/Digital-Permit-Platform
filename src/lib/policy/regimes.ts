export const POLICY_REGIMES = [
  "licensing_act_2003",
  "taxi_private_hire",
] as const;

export type PolicyRegime = (typeof POLICY_REGIMES)[number];

export const DEFAULT_POLICY_REGIME: PolicyRegime = "licensing_act_2003";
export const TAXI_POLICY_REGIME: PolicyRegime = "taxi_private_hire";
export const TAXI_MODULE_CATEGORY = "Taxis and private hire";

export const POLICY_REGIME_CONFIG: Record<
  PolicyRegime,
  {
    label: string;
    shortLabel: string;
    documentTitle: string;
    description: string;
    legalBasis: string;
    requirement: string;
  }
> = {
  licensing_act_2003: {
    label: "Licensing Act policy",
    shortLabel: "Licensing Act",
    documentTitle: "Statement of Licensing Policy",
    description:
      "Premises, club premises, personal licences and temporary event notices.",
    legalBasis: "Licensing Act 2003, section 5",
    requirement: "Statutory statement, normally reviewed at least every five years.",
  },
  taxi_private_hire: {
    label: "Taxi and private hire policy",
    shortLabel: "Taxi and private hire",
    documentTitle: "Hackney carriage and private hire licensing policy",
    description:
      "Taxi and private hire drivers, vehicles and private hire operators.",
    legalBasis:
      "Town Police Clauses Act 1847, Local Government (Miscellaneous Provisions) Act 1976 and any applicable local legislation",
    requirement:
      "DfT-recommended cohesive policy; not itself a mandatory statutory statement.",
  },
};

export function isPolicyRegime(value: unknown): value is PolicyRegime {
  return POLICY_REGIMES.includes(value as PolicyRegime);
}

export function isTaxiModule(category: string, moduleKey = "") {
  const normalizedCategory = category.trim().toLowerCase();
  return (
    normalizedCategory === TAXI_MODULE_CATEGORY.toLowerCase() ||
    /(?:taxi|private_hire|hackney)/i.test(moduleKey)
  );
}

export function policyRegimeForModule(category: string, moduleKey = ""): PolicyRegime {
  return isTaxiModule(category, moduleKey)
    ? TAXI_POLICY_REGIME
    : DEFAULT_POLICY_REGIME;
}

export type TaxiPolicyReadiness =
  | "ready"
  | "policy-missing"
  | "modules-disabled"
  | "not-applicable";

export function getTaxiPolicyReadiness(
  taxiModulesEnabled: boolean,
  activeTaxiPolicy: boolean,
): TaxiPolicyReadiness {
  if (taxiModulesEnabled && activeTaxiPolicy) return "ready";
  if (taxiModulesEnabled) return "policy-missing";
  if (activeTaxiPolicy) return "modules-disabled";
  return "not-applicable";
}