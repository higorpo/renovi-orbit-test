import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClientReceivedServiceGroup, ReceivedStatusFilter } from "../types/client-budgets.types";
import { BudgetPreviewRow } from "./BudgetPreviewRow";
import { ServiceRequestSummaryBlock } from "./ServiceRequestSummaryBlock";
import {
  formatReceivedExtraBudgetsLabel,
  getReceivedBudgetSummaryLine,
  getReceivedCardCtaIcon,
  getReceivedCardCtaLabel,
  getReceivedExtraBudgetCount,
  getServiceBudgetFlowStatus,
} from "../constants/status";

interface ReceivedBudgetServiceCardProps {
  item: ClientReceivedServiceGroup;
  statusFilter: ReceivedStatusFilter;
  onOpenDetails: (serviceRequestId: string) => void;
}

export function ReceivedBudgetServiceCard({ item, statusFilter, onOpenDetails }: ReceivedBudgetServiceCardProps) {
  const budgetFlowStatus = getServiceBudgetFlowStatus(item);
  const location = [item.neighborhood, item.city].filter(Boolean).join(", ");
  const previews = item.budgets_preview.slice(0, 2);
  const extraCount = getReceivedExtraBudgetCount(item, statusFilter);
  const handleOpenDetails = () => onOpenDetails(item.service_request_id);
  const ctaLabel = getReceivedCardCtaLabel(statusFilter, item.submitted_count);
  const CtaIcon = getReceivedCardCtaIcon(statusFilter, item.submitted_count);

  return (
    <Card
      className="flex cursor-pointer flex-col transition-colors hover:border-primary/30"
      role="button"
      tabIndex={0}
      onClick={handleOpenDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenDetails();
        }
      }}
    >
      <CardHeader className="space-y-3 !pb-4">
        <div className="flex items-start justify-between gap-2">
          <ServiceRequestSummaryBlock
            serviceTitle={item.service_title}
            serviceRequestTitle={item.service_request_title}
            description={item.service_request_description}
            iconKey={item.service_icon_key}
            colorKey={item.service_color_key}
            location={location}
            createdAt={item.service_request_created_at}
          />
          <Badge variant={budgetFlowStatus.variant} className="shrink-0">
            {budgetFlowStatus.label}
          </Badge>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {getReceivedBudgetSummaryLine(item, statusFilter)}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 !pt-0">
        {previews.map((budget) => (
          <BudgetPreviewRow key={budget.id} budget={budget} />
        ))}
        {extraCount > 0 ? (
          <p className="text-xs font-medium text-muted-foreground">{formatReceivedExtraBudgetsLabel(extraCount)}</p>
        ) : null}
      </CardContent>
      <CardFooter className="border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 inline-flex items-center gap-1.5"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenDetails();
          }}
        >
          <CtaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
