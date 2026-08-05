"use client";

// ─────────────────────────────────────────────────────────────
// Admin-side guided tour — the "modular management" walkthrough.
// Runs on the module registry (/admin). Triggered by the hand-off
// from the main tour (?tour=admin) or the "Take a tour" button.
// ─────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

function buildAdminSteps(): DriveStep[] {
  const has = (sel: string) =>
    typeof document !== "undefined" && !!document.querySelector(sel);

  const steps: DriveStep[] = [];

  steps.push({
    popover: {
      title: "The admin side — modular management",
      description:
        "This is where a council runs the platform. Every licence and permit is a configurable module: you decide which ones to offer and exactly how each one works — without writing code.",
    },
  });

  if (has("#admin-tour-stats"))
    steps.push({
      element: "#admin-tour-stats",
      popover: {
        title: "Your estate at a glance",
        description:
          "How many permit types exist, how many are switched on, how many are turned off, and how many service categories they span.",
        side: "bottom",
        align: "start",
      },
    });

  if (has("#admin-tour-modules"))
    steps.push({
      element: "#admin-tour-modules",
      popover: {
        title: "Every permit type is a module",
        description:
          "The whole catalogue in one registry, grouped by service. Each row is a live permit type with its own version and a count of applications received.",
        side: "top",
        align: "start",
      },
    });

  if (has("#admin-tour-toggle"))
    steps.push({
      element: "#admin-tour-toggle",
      popover: {
        title: "Cut out or bolt on",
        description:
          "Switch any permit type on or off here. Disable one and it disappears from the public catalogue straight away; enable it and residents can apply again — no deployment needed.",
        side: "left",
        align: "start",
      },
    });

  if (has("#admin-tour-edit"))
    steps.push({
      element: "#admin-tour-edit",
      popover: {
        title: "Edit without code",
        description:
          "Open the module builder to change the form fields, required documents, fees and workflow for a permit. Every change is versioned, so applications already in progress keep the rules they started under.",
        side: "left",
        align: "start",
      },
    });

  if (has("#admin-tour-create"))
    steps.push({
      element: "#admin-tour-create",
      popover: {
        title: "Add a brand-new permit",
        description:
          "Create a permit type from scratch — the same way Blue Badge was added — then publish it when you're ready.",
        side: "bottom",
        align: "end",
      },
    });

  steps.push({
    popover: {
      title: "More admin tools",
      description:
        "The top menu also has Licences (issued permits and the public register), Users (staff accounts and roles), and an Audit log that records every change — who did what, and when.",
    },
  });

  steps.push({
    popover: {
      title: "That's the admin side",
      description:
        "This is how a council tailors the platform to exactly the services it runs. You can reopen this walkthrough any time with ‘Take a tour’ on the module registry.",
    },
  });

  return steps;
}

let adminAutoStarted = false;

export function AdminTour() {
  useEffect(() => {
    const start = () => {
      const instance = driver({
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
        steps: buildAdminSteps(),
      });
      instance.drive();
    };

    const onStartEvent = () => start();
    window.addEventListener("dpp:start-admin-tour", onStartEvent);

    let forced = false;
    try {
      forced =
        new URLSearchParams(window.location.search).get("tour") === "admin";
    } catch {
      /* ignore */
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (forced && !adminAutoStarted) {
      // Strip the query inside the delayed start (not before) so React
      // strict-mode's mount → cleanup → mount still sees `forced` on the
      // second mount; a module-level guard prevents a double launch.
      timer = setTimeout(() => {
        if (adminAutoStarted) return;
        adminAutoStarted = true;
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("tour");
          window.history.replaceState({}, "", url.toString());
        } catch {
          /* ignore */
        }
        start();
      }, 700);
    }

    return () => {
      window.removeEventListener("dpp:start-admin-tour", onStartEvent);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

export default AdminTour;
