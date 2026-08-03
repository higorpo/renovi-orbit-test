import { cn } from "@/lib/utils";

export type KycWizardStepperProps = {
  /** 1-based current step index. */
  currentStep: number;
  totalSteps: number;
  className?: string;
};

/**
 * Segmented progress for the KYC wizard — one segment per step, filled through the current step.
 */
export function KycWizardStepper({
  currentStep,
  totalSteps,
  className,
}: KycWizardStepperProps) {
  return (
    <div
      className={cn("flex w-full gap-1.5", className)}
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Passo ${currentStep} de ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isFilled = stepNumber <= currentStep;

        return (
          <div
            key={stepNumber}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              isFilled ? "bg-primary" : "bg-muted",
            )}
          />
        );
      })}
    </div>
  );
}
