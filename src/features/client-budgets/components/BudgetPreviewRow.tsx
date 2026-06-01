import { CalendarClock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import type { BudgetPreviewItem } from "../types/client-budgets.types";
import { BudgetStatusBadge } from "./BudgetStatusBadge";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "P").toUpperCase();
}

export function BudgetPreviewRow({ budget }: { budget: BudgetPreviewItem }) {
  const { url } = usePublicProfileImageUrl(budget.provider_profile_image_path);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={url} alt={budget.provider_name} />
            <AvatarFallback>{initials(budget.provider_name)}</AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium">{budget.provider_name}</p>
        </div>
        <p className="text-sm font-semibold">{formatCurrency(budget.proposed_amount)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatRelativeDate(budget.created_at)}
        </p>
      </div>
      <BudgetStatusBadge status={budget.status} />
    </div>
  );
}
