import type { ComponentType } from "react";
import { Timer, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import {
  COMPLEXITY_LABELS,
  DURATION_LABELS,
} from "./JobDetail.constants";
import type { EstimatedDurationHintKey } from "supabase/functions/generate-smart-description/allowedValues";

export function JobDetailMetadataBadges({ job }: { job: ProviderJobItem }) {
  const items: Array<{
    icon: ComponentType<{ className?: string }>;
    label: string;
    className?: string;
  }> = [];

  if (
    job.estimated_duration_hint &&
    DURATION_LABELS[job.estimated_duration_hint as EstimatedDurationHintKey]
  ) {
    items.push({
      icon: Timer,
      label:
        DURATION_LABELS[job.estimated_duration_hint as EstimatedDurationHintKey] +
        " (aprox.)",
    });
  }

  if (job.scope_complexity) {
    items.push({
      icon: Wrench,
      label: `Complexidade: ${COMPLEXITY_LABELS[job.scope_complexity] ?? job.scope_complexity}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ icon: Icon, label, className }) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground",
            className,
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
