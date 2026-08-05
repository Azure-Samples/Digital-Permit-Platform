import { format } from "date-fns";
import type { SlaInfo, SlaState } from "@/lib/sla";

const TAG_CLASS: Record<SlaState, string> = {
  on_track: "govuk-tag govuk-tag--grey",
  due_soon: "govuk-tag govuk-tag--yellow",
  due_today: "govuk-tag govuk-tag--orange",
  breached: "govuk-tag govuk-tag--red",
};

function pluralDays(n: number): string {
  return `${n} working ${n === 1 ? "day" : "days"}`;
}

function badgeText(sla: SlaInfo): string {
  switch (sla.state) {
    case "breached":
      return `${sla.overdueBusinessDays}d overdue`;
    case "due_today":
      return "Due today";
    case "due_soon":
      return `${sla.remainingBusinessDays}d left`;
    default:
      return `SLA ${sla.usedBusinessDays}/${sla.slaBusinessDays}`;
  }
}

function fullText(sla: SlaInfo): string {
  const base = `${sla.usedBusinessDays} of ${sla.slaBusinessDays} working days used on “${sla.stageLabel}”`;
  if (sla.state === "breached") {
    return `${base} — ${pluralDays(sla.overdueBusinessDays)} overdue (was due ${format(sla.dueDate, "d MMM yyyy")}).`;
  }
  if (sla.state === "due_today") {
    return `${base} — due today (${format(sla.dueDate, "d MMM yyyy")}).`;
  }
  return `${base} — ${pluralDays(sla.remainingBusinessDays)} left (due ${format(sla.dueDate, "d MMM yyyy")}).`;
}

/** Compact SLA tag for tables and lists. Renders nothing when no SLA applies. */
export function SlaBadge({ sla }: { sla: SlaInfo | null }) {
  if (!sla) return <span className="text-govuk-dark-grey text-sm">—</span>;
  return (
    <span
      className={`${TAG_CLASS[sla.state]} text-xs whitespace-nowrap`}
      title={fullText(sla)}
    >
      {badgeText(sla)}
    </span>
  );
}

const BANNER_CLASS: Record<SlaState, string> = {
  on_track: "border-govuk-blue bg-[#eef6fb]",
  due_soon: "border-[#b35900] bg-[#fff6e8]",
  due_today: "border-[#b35900] bg-[#fff6e8]",
  breached: "border-govuk-red bg-[#fef2f2]",
};

function bannerHeadline(sla: SlaInfo): string {
  switch (sla.state) {
    case "breached":
      return `SLA breached — ${pluralDays(sla.overdueBusinessDays)} overdue`;
    case "due_today":
      return `SLA due today — ${sla.usedBusinessDays} of ${sla.slaBusinessDays} working days used`;
    case "due_soon":
      return `SLA due soon — ${pluralDays(sla.remainingBusinessDays)} left`;
    default:
      return `On track — ${sla.usedBusinessDays} of ${sla.slaBusinessDays} working days used`;
  }
}

/** Prominent SLA banner for the case detail page. */
export function SlaBanner({ sla }: { sla: SlaInfo | null }) {
  if (!sla) return null;
  const pct = Math.min(
    100,
    Math.round((sla.usedBusinessDays / sla.slaBusinessDays) * 100)
  );
  const barColour =
    sla.state === "breached"
      ? "bg-govuk-red"
      : sla.state === "on_track"
        ? "bg-govuk-blue"
        : "bg-[#b35900]";
  return (
    <div className={`border-l-4 p-4 mb-6 ${BANNER_CLASS[sla.state]}`}>
      <p className="font-bold mb-1">{bannerHeadline(sla)}</p>
      <p className="text-sm text-govuk-dark-grey mb-2">
        Stage “{sla.stageLabel}” · entered {format(sla.enteredAt, "d MMM yyyy")} ·{" "}
        {sla.state === "breached" ? "was due" : "due"}{" "}
        {format(sla.dueDate, "d MMM yyyy")}
      </p>
      <div
        className="h-2 w-full max-w-md bg-govuk-mid-grey"
        role="progressbar"
        aria-valuenow={sla.usedBusinessDays}
        aria-valuemin={0}
        aria-valuemax={sla.slaBusinessDays}
        aria-label={`${sla.usedBusinessDays} of ${sla.slaBusinessDays} working days used`}
      >
        <div className={`h-2 ${barColour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Dashboard notification banner summarising SLA risk across the queue. */
export function SlaAlert({
  breached,
  dueToday,
  dueSoon,
}: {
  breached: number;
  dueToday: number;
  dueSoon: number;
}) {
  if (breached + dueToday + dueSoon === 0) return null;
  const critical = breached + dueToday > 0;
  const parts: string[] = [];
  if (breached > 0)
    parts.push(`${breached} over SLA`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  if (dueSoon > 0) parts.push(`${dueSoon} due soon`);

  return (
    <div
      className={`border-l-4 p-4 mb-6 ${
        critical ? "border-govuk-red bg-[#fef2f2]" : "border-[#b35900] bg-[#fff6e8]"
      }`}
      role="status"
    >
      <p className="font-bold mb-1">
        SLA attention needed — {parts.join(" · ")}
      </p>
      <p className="text-sm text-govuk-dark-grey mb-0">
        {critical
          ? "Some cases have missed or are hitting their working-day target today. Review them first."
          : "Some cases are close to their working-day target. Review them soon to stay within SLA."}
      </p>
    </div>
  );
}
