import { Link, useLocation } from "react-router";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, MessageSquare, Eye, Clock, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import {
  createProviderJobsServiceDetailState,
  getServiceDetailPath,
} from "@/features/view-services";
import { getUrgencyConfig } from "@/features/view-services";
import type { ListProviderOpportunityItem } from "../types/provider-jobs.types";
import { DismissOpportunityButton } from "./DismissOpportunityButton";

export interface JobCardProps {
  job: ListProviderOpportunityItem;
  className?: string;
  onDismiss?: (serviceRequestId: string) => void;
  isDismissing?: boolean;
}

export function JobCard({ job, className, onDismiss, isDismissing = false }: JobCardProps) {
  const location = useLocation();
  const detailPath = getServiceDetailPath(job.service_request_id);
  const linkState = createProviderJobsServiceDetailState(location);
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });
  const urgencyBadge = getUrgencyConfig(job.urgency);

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
        aria-label={`Ver detalhes: ${job.title}`}
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
                <p className="hidden text-xs font-medium text-muted-foreground sm:block">
                  {job.service_name}
                </p>
                <h2 className="mt-0.5 hidden text-lg font-semibold leading-tight sm:block">
                  {job.title}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {urgencyBadge && (
                <Badge variant={urgencyBadge.variant} className="shrink-0">
                  {urgencyBadge.label}
                </Badge>
              )}
              {job.source === "fallback" && (
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Briefcase className="h-3 w-3" aria-hidden />
                  Mercado aberto
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-1 w-full min-w-0 space-y-0.5 sm:mt-0 sm:hidden">
            <p className="text-xs font-medium text-muted-foreground">
              {job.service_name}
            </p>
            <h2 className="text-lg font-semibold leading-tight">
              {job.title}
            </h2>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {job.neighborhood}
            </span>
            {job.distance_km != null && (
              <span className="font-medium text-foreground">
                {formatDistance(job.distance_km)} de você
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatRelativeDate(job.granted_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {job.active_chat_count_24h}{" "}
              {job.active_chat_count_24h === 1 ? "conversa ativa" : "conversas ativas"}
            </span>
          </div>
        </CardHeader>
      </Link>

      <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
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
        {onDismiss && (
          <DismissOpportunityButton
            serviceRequestId={job.service_request_id}
            onDismiss={onDismiss}
            isLoading={isDismissing}
          />
        )}
      </CardFooter>
    </Card>
  );
}
