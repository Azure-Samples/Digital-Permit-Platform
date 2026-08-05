"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  ClipboardPaste,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Clock,
  ShieldCheck,
  UserCheck,
  ScrollText,
  RotateCcw,
} from "lucide-react";
import { RagBadge, RagDot } from "./rag-badge";
import { ChatPanel } from "./chat-panel";
import type {
  LicenceSummary,
  ComplianceAssessment,
} from "@/lib/ai/types";

type Status = "IDLE" | "PROCESSING" | "COMPLETE" | "FAILED";

interface AnalysisResult {
  id: string;
  title: string;
  status: Status;
  summary?: LicenceSummary | null;
  compliance?: ComplianceAssessment | null;
  errorMessage?: string | null;
  tokensUsed?: number;
}

const PROGRESS_STEPS = [
  "Reading the document…",
  "Extracting premises, hours and conditions…",
  "Checking the six mandatory conditions…",
  "Assessing against the Statement of Licensing Policy…",
  "Finalising the at-a-glance summary…",
];

export function LicenceAnalyser() {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    pollRef.current = null;
    progressRef.current = null;
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  const poll = useCallback(
    (id: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/ai/licence-analysis/${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load analysis");
          if (data.status === "COMPLETE" || data.status === "FAILED") {
            stopTimers();
            setBusy(false);
            setResult(data);
            if (data.status === "FAILED") {
              setError(data.errorMessage || "Analysis failed.");
            }
          }
        } catch (e) {
          stopTimers();
          setBusy(false);
          setError((e as Error).message);
        }
      }, 2500);
    },
    [stopTimers]
  );

  async function start(payload: FormData | { text: string; title?: string }) {
    setError(null);
    setResult(null);
    setBusy(true);
    setProgressStep(0);
    progressRef.current = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 6000);

    try {
      const res = await fetch("/api/ai/licence-analysis", {
        method: "POST",
        ...(payload instanceof FormData
          ? { body: payload }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start analysis.");
      poll(data.id);
    } catch (e) {
      stopTimers();
      setBusy(false);
      setError((e as Error).message);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "upload") {
      if (!file) {
        setError("Choose a PDF or text file to analyse.");
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      start(fd);
    } else {
      if (text.trim().length < 40) {
        setError("Paste at least a few lines of the licence text.");
        return;
      }
      start({ text, title: "Pasted licence text" });
    }
  }

  async function loadSample() {
    setError(null);
    try {
      const res = await fetch("/templates/sample-premises-licence.txt");
      const sample = await res.text();
      setMode("paste");
      setText(sample);
    } catch {
      setError("Could not load the sample licence.");
    }
  }

  function reset() {
    stopTimers();
    setResult(null);
    setError(null);
    setBusy(false);
    setFile(null);
    setText("");
  }

  // ── Result view ──────────────────────────────────────────
  if (result?.status === "COMPLETE" && result.summary) {
    return (
      <AnalysisResultView result={result} onReset={reset} />
    );
  }

  // ── Input / processing view ──────────────────────────────
  return (
    <div>
      {busy ? (
        <div className="bg-white border border-govuk-mid-grey p-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-govuk-blue mx-auto mb-4" />
          <p className="font-bold text-lg mb-2">Analysing the licence</p>
          <p className="text-govuk-dark-grey mb-4">{PROGRESS_STEPS[progressStep]}</p>
          <div className="max-w-md mx-auto flex gap-1">
            {PROGRESS_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 ${
                  i <= progressStep ? "bg-govuk-blue" : "bg-govuk-mid-grey"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-govuk-dark-grey mt-4">
            This usually takes 20–40 seconds. A real Azure OpenAI model is reading
            the full document.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-govuk-mid-grey p-6">
          <div className="flex gap-1 mb-4 border-b border-govuk-mid-grey">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`px-4 py-2 text-sm font-bold border-b-4 -mb-px ${
                mode === "upload"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-dark-grey"
              }`}
            >
              <Upload className="h-4 w-4 inline mr-1" /> Upload a file
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`px-4 py-2 text-sm font-bold border-b-4 -mb-px ${
                mode === "paste"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-dark-grey"
              }`}
            >
              <ClipboardPaste className="h-4 w-4 inline mr-1" /> Paste text
            </button>
          </div>

          {mode === "upload" ? (
            <div>
              <label className="govuk-label" htmlFor="licence-file">
                Licence document (PDF or text, up to 10MB)
              </label>
              <p className="govuk-hint">
                Upload a premises licence, club premises certificate or similar.
              </p>
              <input
                id="licence-file"
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full border-2 border-govuk-black p-2 text-base file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-govuk-blue file:text-white file:font-bold"
              />
              {file && (
                <p className="mt-2 text-sm text-govuk-dark-grey flex items-center gap-1">
                  <FileText className="h-4 w-4" /> {file.name}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="govuk-label" htmlFor="licence-text">
                Paste the licence text
              </label>
              <textarea
                id="licence-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Paste the full text of the licence here…"
                className="govuk-textarea font-mono text-sm"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 border-l-4 border-govuk-red bg-[#fef7f7] text-govuk-red text-sm">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <button type="submit" className="govuk-button">
              Analyse licence
            </button>
            <button
              type="button"
              onClick={loadSample}
              className="text-sm text-govuk-blue underline"
            >
              Load a sample premises licence
            </button>
          </div>
        </form>
      )}

      {result?.status === "FAILED" && !busy && (
        <div className="mt-4 govuk-warning-text">
          <AlertTriangle className="h-6 w-6 text-govuk-red shrink-0" />
          <div>
            <p className="font-bold">Could not analyse this document</p>
            <p className="text-sm">{result.errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Result view
// ─────────────────────────────────────────────────────────────
function AnalysisResultView({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const s = result.summary!;
  const c = result.compliance;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="govuk-tag govuk-tag--purple mb-2">{s.documentType}</span>
          <h2 className="mb-1">{s.premisesName || result.title}</h2>
          {s.licenceNumber && (
            <p className="text-govuk-dark-grey text-sm font-mono">{s.licenceNumber}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="govuk-button govuk-button--secondary"
        >
          <RotateCcw className="h-4 w-4 mr-1" /> Analyse another
        </button>
      </div>

      {/* At a glance */}
      <section className="bg-[#eef6fb] border-l-4 border-govuk-blue p-4">
        <h3 className="flex items-center gap-2 !mb-2">
          <ShieldCheck className="h-5 w-5 text-govuk-blue" /> At a glance
        </h3>
        <p className="leading-relaxed">{s.atAGlance}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key facts */}
        <section className="bg-white border border-govuk-mid-grey p-5">
          <h3 className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-govuk-blue" /> Key details
          </h3>
          <dl className="govuk-summary-list text-sm">
            <Row label="Premises" value={s.premisesName} />
            <Row label="Address" value={s.premisesAddress} />
            <Row label="Licence holder" value={s.licenceHolder} />
            <Row
              label="DPS"
              value={
                s.designatedPremisesSupervisor?.name
                  ? `${s.designatedPremisesSupervisor.name}${
                      s.designatedPremisesSupervisor.personalLicenceNumber
                        ? ` (${s.designatedPremisesSupervisor.personalLicenceNumber})`
                        : ""
                    }`
                  : null
              }
            />
            <Row label="Opening hours" value={s.openingHours} />
          </dl>
        </section>

        {/* Licensable activities */}
        <section className="bg-white border border-govuk-mid-grey p-5">
          <h3 className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-govuk-blue" /> Licensable activities &amp; hours
          </h3>
          {s.licensableActivities.length === 0 ? (
            <p className="text-govuk-dark-grey text-sm">None identified.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {s.licensableActivities.map((a, i) => (
                <li key={i} className="border-b border-govuk-light-grey pb-2">
                  <span className="font-bold">{a.activity}</span>
                  {(a.days || a.hours) && (
                    <span className="block text-govuk-dark-grey">
                      {[a.days, a.hours].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Mandatory conditions */}
      <section className="bg-white border border-govuk-mid-grey p-5">
        <h3 className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-govuk-blue" /> Mandatory conditions
        </h3>
        <p className="govuk-hint">
          The six statutory conditions for premises selling alcohol.
        </p>
        <ul className="space-y-2">
          {s.mandatoryConditions.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {m.present ? (
                <CheckCircle2 className="h-5 w-5 text-govuk-green shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-govuk-red shrink-0 mt-0.5" />
              )}
              <span>
                <span className="font-bold">{m.condition}</span>
                {m.note && <span className="block text-govuk-dark-grey">{m.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConditionList
          title="Operating schedule conditions"
          items={s.operatingScheduleConditions}
        />
        <ConditionList
          title="Responsible authority conditions"
          items={s.responsibleAuthorityConditions}
          showSource
        />
      </div>

      {/* Objective risks */}
      {s.objectiveRisks.length > 0 && (
        <section className="bg-white border border-govuk-mid-grey p-5">
          <h3>Risk against the licensing objectives</h3>
          <ul className="space-y-2">
            {s.objectiveRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1">
                  <RagDot rating={r.level} />
                </span>
                <span>
                  <span className="font-bold">{r.objective}</span>
                  <span className="block text-govuk-dark-grey">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Compliance */}
      {c && <CompliancePanel compliance={c} />}

      {/* Officer actions */}
      {s.officerActions.length > 0 && (
        <section className="bg-white border border-govuk-mid-grey p-5">
          <h3>Suggested checks for the officer / police</h3>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            {s.officerActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Chat about this licence */}
      <section>
        <h3 className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-govuk-blue" /> Ask about this licence
        </h3>
        <p className="govuk-hint">
          The copilot can answer questions using this licence and the council policy.
        </p>
        <ChatPanel
          persona="officer"
          analysisId={result.id}
          placeholder="e.g. What are the off-sales hours? Is CCTV required?"
          suggestions={[
            "Summarise the crime and disorder conditions.",
            "Is this premises in the cumulative impact area?",
            "What must the DPS do under this licence?",
            "Are all six mandatory conditions covered?",
          ]}
        />
      </section>

      {typeof result.tokensUsed === "number" && result.tokensUsed > 0 && (
        <p className="text-xs text-govuk-dark-grey">
          Generated by Azure OpenAI · {result.tokensUsed.toLocaleString()} tokens used.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="govuk-summary-list__row">
      <dt className="govuk-summary-list__key">{label}</dt>
      <dd className="govuk-summary-list__value">
        {value || <span className="text-govuk-dark-grey">Not stated</span>}
      </dd>
    </div>
  );
}

function ConditionList({
  title,
  items,
  showSource,
}: {
  title: string;
  items: { text: string; source?: string | null }[];
  showSource?: boolean;
}) {
  return (
    <section className="bg-white border border-govuk-mid-grey p-5">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="text-govuk-dark-grey text-sm">None identified.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-govuk-blue font-bold">{i + 1}.</span>
              <span>
                {it.text}
                {showSource && it.source && (
                  <span className="ml-1 text-xs bg-govuk-light-grey px-1.5 py-0.5">
                    {it.source}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CompliancePanel({
  compliance,
}: {
  compliance: ComplianceAssessment;
}) {
  const border =
    compliance.overall === "green"
      ? "border-govuk-green"
      : compliance.overall === "red"
        ? "border-govuk-red"
        : compliance.overall === "na"
          ? "border-govuk-mid-grey"
          : "border-[#b35900]";
  return (
    <section className={`bg-white border border-l-8 ${border} border-govuk-mid-grey p-5`}>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <h3 className="!mb-0">Policy compliance</h3>
        <RagBadge rating={compliance.overall} label={compliance.overallLabel} />
      </div>
      <p className="leading-relaxed mb-4">{compliance.headline}</p>

      <div className="space-y-3">
        {compliance.checks.map((ck, i) => (
          <div key={i} className="border-l-4 border-govuk-mid-grey pl-3 py-1">
            <div className="flex items-center gap-2">
              <RagDot rating={ck.rating} />
              <span className="font-bold text-sm">{ck.area}</span>
              {ck.policyRef && (
                <span className="text-xs bg-govuk-light-grey px-1.5 py-0.5">
                  Policy {ck.policyRef}
                </span>
              )}
            </div>
            <p className="text-sm text-govuk-dark-grey mt-1">{ck.finding}</p>
          </div>
        ))}
      </div>

      {compliance.recommendations.length > 0 && (
        <div className="mt-4">
          <p className="font-bold text-sm mb-1">Recommendations</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            {compliance.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
