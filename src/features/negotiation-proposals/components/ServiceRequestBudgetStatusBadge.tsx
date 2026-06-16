import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBudgetStatusConfig } from "../constants/serviceRequestBudgetSheet";

export function ServiceRequestBudgetStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const config = getBudgetStatusConfig(status);
  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
