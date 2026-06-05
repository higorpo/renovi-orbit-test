import type { ComponentType } from "react";
import { Timer, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceModel } from "../types/service.types";
import {
  getComplexityLabel,
  getDurationLabel,
} from "../constants/serviceDetail.constants";

export function ServiceDetailMetadataBadges({ model }: { model: ServiceModel }) {
  const items: Array<{
    icon: ComponentType<{ className?: string }>;
    label: string;
    className?: string;
  }> = [];

  const durationLabel = getDurationLabel(model.estimatedDurationHint);
  if (durationLabel) {
    items.push({
      icon: Timer,
      label: `${durationLabel} (aprox.)`,
    });
  }

  const complexityLabel = getComplexityLabel(model.scopeComplexity);
  if (complexityLabel) {
    items.push({
      icon: Wrench,
      label: `Complexidade: ${complexityLabel}`,
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
