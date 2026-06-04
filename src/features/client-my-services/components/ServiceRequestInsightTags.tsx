import { Badge } from "@/components/ui/badge";
import { buildServiceRequestInsightTags } from "../utils/buildServiceRequestInsightTags";
import type { ServiceRequestCardModel } from "../types/client-my-services.types";

interface ServiceRequestInsightTagsProps {
  model: ServiceRequestCardModel;
  className?: string;
}

export function ServiceRequestInsightTags({ model, className }: ServiceRequestInsightTagsProps) {
  const items = buildServiceRequestInsightTags({
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
