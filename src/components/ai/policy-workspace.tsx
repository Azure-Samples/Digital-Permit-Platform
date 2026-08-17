"use client";

import { useState } from "react";
import { FileSearch, MessagesSquare } from "lucide-react";
import { LicenceAnalyser } from "./licence-analyser";
import { ChatPanel } from "./chat-panel";
import type { PolicyRegime } from "@/lib/policy/regimes";

export function PolicyWorkspace({
  activeRegimes,
}: {
  activeRegimes: PolicyRegime[];
}) {
  const [tab, setTab] = useState<"analyse" | "ask">("analyse");
  const taxiPolicyActive = activeRegimes.includes("taxi_private_hire");

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-govuk-mid-grey">
        <TabButton
          active={tab === "analyse"}
          onClick={() => setTab("analyse")}
          icon={<FileSearch className="h-4 w-4" />}
          label="Analyse a licence"
        />
        <TabButton
          active={tab === "ask"}
          onClick={() => setTab("ask")}
          icon={<MessagesSquare className="h-4 w-4" />}
          label="Ask the policy"
        />
      </div>

      {tab === "analyse" ? (
        <LicenceAnalyser />
      ) : (
        <div className="max-w-3xl">
          <p className="text-govuk-dark-grey mb-4">
            {taxiPolicyActive
              ? "Ask about premises licensing or taxi/private-hire licensing in the same conversation. Copilot chooses the relevant active policy and cites its source."
              : "Ask about the council's Licensing Act policy and procedure. Answers use the active statement and cite its source."}
          </p>
          <ChatPanel
            persona="officer"
            placeholder="e.g. What is the presumption in the cumulative impact area?"
            suggestions={[
              "What conditions do we expect for late-night off-sales?",
              "How does the cumulative impact policy work?",
              ...(taxiPolicyActive
                ? [
                    "What is our fit and proper test for taxi drivers?",
                    "What vehicle standards apply to private hire applications?",
                  ]
                : [
                    "When can the police object to a change of DPS?",
                    "What are the mandatory conditions for alcohol sales?",
                  ]),
            ]}
          />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-4 -mb-px ${
        active
          ? "border-govuk-blue text-govuk-blue"
          : "border-transparent text-govuk-dark-grey hover:text-govuk-blue"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
