import { Badge } from "@/components/ui/badge";
import { getBudgetStatusConfig } from "../constants/status";

export function BudgetStatusBadge({ status }: { status: string | null | undefined }) {
  const config = getBudgetStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
