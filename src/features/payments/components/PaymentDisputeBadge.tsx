import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PaymentDisputeBadgeProps = {
  className?: string;
};

export function PaymentDisputeBadge({ className }: PaymentDisputeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
    >
      <Scale className="h-3 w-3 shrink-0" aria-hidden />
      Chargeback em análise
    </Badge>
  );
}
