import { Check, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_JOURNEY_CARD_TITLE } from "../constants/serviceJourney.constants";
import type { PresentedServiceJourneyMilestone } from "../types/serviceJourney.types";

export interface ServiceJourneyCardProps {
  milestones: PresentedServiceJourneyMilestone[];
  className?: string;
}

function MilestoneMarker({
  status,
}: {
  status: PresentedServiceJourneyMilestone["status"];
}) {
  if (status === "completed") {
    return (
      <span
        className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_1px_2px_hsl(var(--success)/0.35)]"
        aria-hidden
      >
        <Check className="h-4 w-4" strokeWidth={2.75} />
      </span>
    );
  }

  if (status === "current") {
    return (
      <span
        className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper text-copper-foreground shadow-[0_1px_2px_hsl(var(--copper)/0.4)] ring-4 ring-copper/15"
        aria-hidden
      >
        <Diamond className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-muted-foreground/30 bg-card"
      aria-hidden
    />
  );
}

/** Success rail through completed→current; muted after the active step. */
function connectorClass(
  from: PresentedServiceJourneyMilestone["status"],
  to: PresentedServiceJourneyMilestone["status"],
): string {
  const activeSegment =
    (from === "completed" || from === "current") &&
    (to === "completed" || to === "current");
  return activeSegment ? "bg-success" : "bg-border";
}

export function ServiceJourneyCard({
  milestones,
  className,
}: ServiceJourneyCardProps) {
  if (milestones.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card px-5 py-5 shadow-elevation-1 sm:px-6 sm:py-6",
        className,
      )}
      aria-label={SERVICE_JOURNEY_CARD_TITLE}
      data-testid="service-journey-card"
    >
      <h2 className="font-display text-[1.05rem] font-semibold leading-tight tracking-tight text-ink sm:text-lg">
        {SERVICE_JOURNEY_CARD_TITLE}
      </h2>

      <ol className="mt-5 sm:mt-6">
        {milestones.map((milestone, index) => {
          const isLast = index === milestones.length - 1;
          const next = milestones[index + 1];

          return (
            <li
              key={`${milestone.key}-${milestone.status}-${index}`}
              className="grid animate-fade-in-up grid-cols-[2rem_minmax(0,1fr)] gap-x-4 opacity-0 [animation-fill-mode:forwards]"
              style={{ animationDelay: `${index * 55}ms` }}
              data-testid={`service-journey-milestone-${milestone.key}`}
              data-status={milestone.status}
            >
              <div className="flex flex-col items-center self-stretch">
                {/* Same height as the copy block so the marker centers on title+subtitle. */}
                <div className="flex h-11 w-8 shrink-0 items-center justify-center">
                  <MilestoneMarker status={milestone.status} />
                </div>
                {!isLast && next ? (
                  <span
                    className={cn(
                      "w-[2px] flex-1 rounded-full",
                      connectorClass(milestone.status, next.status),
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>

              <div
                className={cn(
                  "flex h-11 min-w-0 flex-col justify-center",
                  isLast ? "mb-0" : "mb-5",
                )}
              >
                <p
                  className={cn(
                    "text-[0.9375rem] font-semibold leading-5 tracking-tight",
                    milestone.status === "upcoming"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {milestone.label}
                </p>
                {milestone.secondaryText ? (
                  <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
                    {milestone.secondaryText}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
