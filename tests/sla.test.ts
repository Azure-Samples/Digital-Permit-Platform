import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApplicationStatus } from "@prisma/client";
import { computeApplicationSla, summariseSla } from "../src/lib/sla";

function application(status: ApplicationStatus = "UNDER_REVIEW") {
  return {
    status,
    currentStage: "review",
    submittedAt: new Date("2026-03-02T09:00:00Z"),
    createdAt: new Date("2026-03-02T09:00:00Z"),
    workflowEvents: [
      { toStage: "review", createdAt: new Date("2026-03-02T09:00:00Z") },
    ],
    moduleVersion: {
      workflowDefinition: [
        {
          key: "review",
          label: "Officer review",
          order: 1,
          type: "review",
          slaBusinessDays: 5,
          reminderDays: 2,
        },
      ],
    },
  };
}

describe("application SLA", () => {
  it("marks an active case due soon using business days", () => {
    const result = computeApplicationSla(
      application(),
      new Date("2026-03-06T09:00:00Z"),
    );

    assert.deepEqual(
      result && {
        stageKey: result.stageKey,
        stageLabel: result.stageLabel,
        remainingBusinessDays: result.remainingBusinessDays,
        overdueBusinessDays: result.overdueBusinessDays,
        state: result.state,
      },
      {
      stageKey: "review",
      stageLabel: "Officer review",
      remainingBusinessDays: 1,
      overdueBusinessDays: 0,
      state: "due_soon",
      },
    );
    assert.equal(result?.dueDate.toISOString(), "2026-03-09T09:00:00.000Z");
  });

  it("marks an overdue case as breached and ignores inactive cases", () => {
    const now = new Date("2026-03-10T09:00:00Z");
    const breached = computeApplicationSla(application(), now);
    assert.deepEqual(
      breached && {
        remainingBusinessDays: breached.remainingBusinessDays,
        overdueBusinessDays: breached.overdueBusinessDays,
        state: breached.state,
      },
      { remainingBusinessDays: -1, overdueBusinessDays: 1, state: "breached" },
    );
    assert.equal(computeApplicationSla(application("APPROVED"), now), null);
  });

  it("summarises only cases needing attention", () => {
    const result = summariseSla(
      [application(), application("APPROVED")],
      new Date("2026-03-10T09:00:00Z"),
    );
    assert.deepEqual(result, { breached: 1, dueToday: 0, dueSoon: 0, total: 1 });
  });
});