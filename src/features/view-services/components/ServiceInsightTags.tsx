import { Badge } from "@/components/ui/badge";
import { buildServiceInsightTags } from "../utils/buildServiceInsightTags";
import type { ServiceModel } from "../types/service.types";

interface ServiceInsightTagsProps {
  model: ServiceModel;
  className?: string;
}

export function ServiceInsightTags({ model, className }: ServiceInsightTagsProps) {
  const items = buildServiceInsightTags({
    tags: model.tags,
    urgency: model.urgency,
    scopeComplexity: model.scopeComplexity,
    estimatedDurationHint: model.estimatedDurationHint,
    missingInfoWarnings: model.missingInfoWarnings,
  });

  if (items.length === 0) return null;

  return (
    <div className={className ?? "mt-2 flex flex-wrap gap-1.5"}>
      {items.map((item) => (
        <Badge key={item.key} variant={item.variant} className="font-normal">
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
