/**
 * Progress bar by step. One step = one screen (all blocks of that step).
 */

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useFormContext } from "./FormContext";

interface ProgressBarProps {
  className?: string;
  showLabels?: boolean;
  variant?: "dots" | "bar" | "steps" | "minimal";
}

export function ProgressBar({
  className,
  showLabels = false,
  variant = "bar",
}: ProgressBarProps) {
  const {
    currentStepIndex,
    totalSteps,
    visibleSteps,
    isStepValid,
    currentStepData,
  } = useFormContext();

  const progress =
    totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  if (variant === "minimal") {
    return (
      <div className={cn("text-center", className)}>
        <span className="text-sm text-muted-foreground">
          Etapa{" "}
          <span className="font-semibold text-foreground">{currentStepIndex + 1}</span> de{" "}
          <span className="font-semibold text-foreground">{totalSteps}</span>
        </span>
      </div>
    );
  }

  if (variant === "dots") {
    const maxDots = 12;
    const showDots = totalSteps <= maxDots;
    if (showDots) {
      return (
        <div className={cn("flex flex-col items-center gap-2", className)}>
          <div className="flex items-center justify-center gap-1.5">
            {visibleSteps.map((step, index) => {
              const isCompleted =
                index < currentStepIndex ||
                (index === currentStepIndex && isStepValid(index));
              const isCurrent = index === currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    isCompleted && "bg-primary",
                    isCurrent &&
                      !isCompleted &&
                      "bg-primary/60 ring-2 ring-primary/30 w-2.5 h-2.5",
                    !isCompleted && !isCurrent && "bg-muted"
                  )}
                />
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            Etapa {currentStepIndex + 1} de {totalSteps}
          </span>
        </div>
      );
    }
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground text-center block">
          Etapa {currentStepIndex + 1} de {totalSteps}
        </span>
      </div>
    );
  }

  if (variant === "steps") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-center gap-1">
          {visibleSteps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary/20 text-primary border-2 border-primary",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                {index < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-6 h-0.5 mx-0.5 transition-all duration-300",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        {currentStepData && (
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {currentStepData.icon && (
                <span className="mr-1">{currentStepData.icon}</span>
              )}
              {currentStepData.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Etapa {currentStepIndex + 1} de {totalSteps}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          Etapa {currentStepIndex + 1} de {totalSteps}
        </span>
        <span className="text-primary font-medium">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {showLabels && currentStepData && (
        <p className="text-sm text-center text-muted-foreground">
          {currentStepData.icon && (
            <span className="mr-1">{currentStepData.icon}</span>
          )}
          {currentStepData.title}
        </p>
      )}
    </div>
  );
}
