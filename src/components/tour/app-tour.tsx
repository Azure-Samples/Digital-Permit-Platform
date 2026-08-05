"use client";

// ─────────────────────────────────────────────────────────────
// Digital Permit Platform — guided product tour
// A one-time (replayable) walkthrough that explains what the
// platform is, how it works, and the capabilities behind it.
// Built on driver.js (spotlight + on-brand popovers/arrows).
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const SEEN_KEY = "dpp-tour-seen-v1";

function buildSteps(): DriveStep[] {
  const has = (sel: string) =>
    typeof document !== "undefined" && !!document.querySelector(sel);

  const steps: DriveStep[] = [];

  steps.push({
    popover: {
      title: "Welcome to the Digital Permit Platform",
      description:
        "One place for residents and businesses to apply for council licences and permits — and one place for officers to assess and decide them. The aim is to replace paper forms, PDFs and email chains with a single, trackable digital service. Take a minute to see what it does.",
    },
  });

  if (has("#tour-hero"))
    steps.push({
      element: "#tour-hero",
      popover: {
        title: "Your front door",
        description:
          "Everything starts here. People apply online, save drafts, upload documents and track progress to a decision — without phoning or visiting the council.",
        side: "bottom",
        align: "start",
      },
    });

  if (has("#tour-browse"))
    steps.push({
      element: "#tour-browse",
      popover: {
        title: "One catalogue of everything you offer",
        description:
          "Browse every licence and permit in a single catalogue. Each one lists its requirements, fees and steps up front, so applicants know exactly what they need before they start.",
        side: "bottom",
        align: "start",
      },
    });

  if (has("#tour-categories"))
    steps.push({
      element: "#tour-categories",
      popover: {
        title: "Many permit types, one system",
        description:
          "Alcohol, taxis, animals, gambling, street trading, parking and more all run on the same engine. Every type ships with the platform; each council switches on the ones it needs.",
        side: "top",
        align: "center",
      },
    });

  if (has("#tour-bluebadge"))
    steps.push({
      element: "#tour-bluebadge",
      popover: {
        title: "Bolt on new permit types",
        description:
          "Blue Badge (disabled parking) is a permit, not a licence — added as a module. It runs the same apply → assess → decide journey as everything else, so new services are added as configuration, not code.",
        side: "top",
        align: "center",
      },
    });

  if (has("#tour-ai-help"))
    steps.push({
      element: "#tour-ai-help",
      popover: {
        title: "Help that prevents mistakes",
        description:
          "A multilingual assistant answers plain-language questions so applicants get it right first time — fewer rejected forms and chasing emails. Officers get a Policy Copilot on the staff side to check applications against policy.",
        side: "top",
        align: "start",
      },
    });

  if (has("#tour-how"))
    steps.push({
      element: "#tour-how",
      popover: {
        title: "How an application flows",
        description:
          "Find the permit, check what's needed, create an account, apply and pay, then track it. Behind the scenes it is routed to the right team with SLAs, checks and automatic reminders.",
        side: "right",
        align: "start",
      },
    });

  if (has("#tour-account"))
    steps.push({
      element: "#tour-account",
      popover: {
        title: "Built for both sides of the counter",
        description:
          "Applicants get a dashboard to track everything. Officers, managers and admins get a staff workspace with a work queue, case reviews and reporting.",
        side: "bottom",
        align: "start",
      },
    });

  steps.push({
    popover: {
      title: "Modular management — cut out and bolt on",
      description:
        "Councils tailor the platform to their needs: switch permit types on or off, and edit the forms, documents, fees and workflow for each one from the admin module builder. Changes are versioned, so applications already in flight are never disrupted.",
    },
  });

  return steps;
}

export function AppTour() {
  const [adminPrompt, setAdminPrompt] = useState(false);

  useEffect(() => {
    const markSeen = () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    };

    const start = () => {
      const steps = buildSteps();
      let instance: ReturnType<typeof driver>;
      const last = steps[steps.length - 1];
      if (last?.popover) {
        last.popover.onNextClick = () => {
          instance.destroy();
          setAdminPrompt(true);
        };
      }
      instance = driver({
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        overlayColor: "#0b0c0e",
        overlayOpacity: 0.72,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: "dpp-tour",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        steps,
        onDestroyed: markSeen,
      });
      instance.drive();
    };

    const onStartEvent = () => start();
    window.addEventListener("dpp:start-tour", onStartEvent);

    let forced = false;
    try {
      forced = new URLSearchParams(window.location.search).get("tour") === "1";
    } catch {
      /* ignore */
    }

    // Remove the ?tour=1 query so a page refresh doesn't relaunch the tour.
    if (forced) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        window.history.replaceState({}, "", url.toString());
      } catch {
        /* ignore */
      }
    }

    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (forced || (!seen && window.location.pathname === "/")) {
      // Small delay so the page has painted and anchors exist.
      timer = setTimeout(start, 600);
    }

    return () => {
      window.removeEventListener("dpp:start-tour", onStartEvent);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const startAdminTour = () => {
    window.location.href =
      `/auth/login?callbackUrl=${encodeURIComponent("/admin?tour=admin")}`;
  };

  if (!adminPrompt) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dpp-admin-prompt-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md border-t-[6px] border-govuk-blue bg-white p-6 shadow-2xl">
        <h2
          id="dpp-admin-prompt-title"
          className="text-govuk-l mb-2"
          style={{ color: "#0b2e5e" }}
        >
          Want to see the admin side?
        </h2>
        <p className="mb-5 text-govuk-black">
          That was the resident and officer view. The admin side is where a
          council runs the platform — switching permit types on or off and
          editing their forms, documents, fees and workflow. I can sign you in
          as a demo administrator and walk you through it.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startAdminTour}
            className="govuk-button"
          >
            Sign in to view the admin side
          </button>
          <button
            type="button"
            onClick={() => setAdminPrompt(false)}
            className="govuk-button govuk-button--secondary"
          >
            No thanks
          </button>
        </div>
        <p className="mt-4 text-sm text-govuk-dark-grey">
          For the sample environment, use the synthetic administrator account.
        </p>
      </div>
    </div>
  );
}

export default AppTour;
