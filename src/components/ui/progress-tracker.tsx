interface ProgressTrackerProps {
  steps: Array<{
    key: string;
    label: string;
  }>;
  currentStep: string;
  completedSteps: string[];
}

export function ProgressTracker({
  steps,
  currentStep,
  completedSteps,
}: ProgressTrackerProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="progress-tracker">
        {steps.map((step, index) => {
          const isCurrent = step.key === currentStep;
          const isComplete = completedSteps.includes(step.key);

          let className = "progress-tracker__step";
          if (isCurrent) className += " progress-tracker__step--current";
          else if (isComplete) className += " progress-tracker__step--complete";

          return (
            <li key={step.key} className={className}>
              <span className="sr-only">
                {isComplete
                  ? "Completed: "
                  : isCurrent
                  ? "Current: "
                  : `Step ${index + 1}: `}
              </span>
              <span className="text-xs block mb-1 opacity-70">
                Step {index + 1}
              </span>
              {step.label}
              {isComplete && (
                <span className="ml-1 text-govuk-green" aria-hidden="true">
                  ✓
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
