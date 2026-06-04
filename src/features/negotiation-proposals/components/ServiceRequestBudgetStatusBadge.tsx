import { Badge } from "@/components/ui/badge";
import { getBudgetStatusConfig } from "../constants/serviceRequestBudgetSheet";

export function ServiceRequestBudgetStatusBadge({ status }: { status: string | null | undefined }) {
  const config = getBudgetStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
