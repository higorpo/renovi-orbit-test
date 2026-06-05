import { Link, useLocation } from "react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Eye, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getServiceCardStyle,
  useServiceRequestPhotoUrls,
} from "@/features/request-quote";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import {
  createProviderBudgetsServiceDetailState,
  getServiceDetailPath,
} from "@/features/view-services";
import type { ProviderSentBudget } from "../types/provider-budgets.types";
import { getBudgetStatusConfig } from "../constants/budgetStatus";

export interface BudgetCardProps {
  budget: ProviderSentBudget;
  className?: string;
}

export function BudgetCard({ budget, className }: BudgetCardProps) {
  const location = useLocation();
  const detailPath = getServiceDetailPath(budget.service_request_id);
  const linkState = createProviderBudgetsServiceDetailState(location);

  const { urls: photoUrls, isLoading: photoUrlsLoading } =
    useServiceRequestPhotoUrls(budget.service_request_photos);

  const serviceStyle = getServiceCardStyle({
    icon_key: budget.service_icon_key,
    color_key: budget.service_color_key,
  });

  const statusConfig = getBudgetStatusConfig(budget.status);
  const locationLine = [budget.neighborhood, budget.city]
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      className={cn(
        "flex flex-col transition-colors hover:border-primary/30",
        className,
      )}
    >
      <Link
        to={detailPath}
        state={linkState}
        className="contents"
        aria-label={`Ver detalhes: ${budget.service_request_title}`}
      >
        <CardHeader className="!pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                  serviceStyle.color,
                )}
                aria-hidden
              >
                <serviceStyle.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {budget.service_title}
                </p>
                <h2 className="mt-0.5 text-base font-semibold leading-tight sm:text-lg">
                  {budget.service_request_title}
                </h2>
              </div>
            </div>

            <Badge variant={statusConfig.variant} className="shrink-0">
              {statusConfig.label}
            </Badge>
          </div>

          {budget.service_request_description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {budget.service_request_description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {locationLine && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {locationLine}
              </span>
            )}
            <span className="text-xs">{budget.masked_client_name}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Enviado {formatRelativeDate(budget.created_at).toLowerCase()}
            </span>
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatCurrency(budget.proposed_amount)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="!pt-0">
          {(budget.service_request_photos?.length ?? 0) > 0 && (
            <ImagePreviewStrip
              urls={photoUrls}
              isLoading={photoUrlsLoading}
              className="mt-1"
            />
          )}
        </CardContent>
      </Link>

      <CardFooter className="mt-auto border-t pt-3">
        <Button variant="outline" size="sm" className="h-9 min-h-9" asChild>
          <Link
            to={detailPath}
            state={linkState}
            className="inline-flex items-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Ver detalhes
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
