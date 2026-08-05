"use client";

import { Compass } from "lucide-react";

/**
 * Launches the guided product tour. Dispatches an event the mounted
 * <AppTour /> listens for, so the tour can be replayed on demand.
 */
export function TourLauncher({
  className,
  label = "Take a tour",
  event = "dpp:start-tour",
}: {
  className?: string;
  label?: string;
  event?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(event))}
      className={
        className ??
        "inline-flex items-center gap-2 border-2 border-white bg-transparent px-4 py-[10px] font-bold text-white no-underline transition-colors hover:bg-white/10"
      }
    >
      <Compass className="h-5 w-5" />
      {label}
    </button>
  );
}

export default TourLauncher;
