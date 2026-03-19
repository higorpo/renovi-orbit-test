import { Link } from "react-router";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  MessageSquare,
  Eye,
  Clock,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle, useServiceRequestPhotoUrls } from "@/features/request-quote";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";
import { formatDistance } from "@/lib/formatDistance";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import type { JobDetailLocationState } from "../types/provider-jobs.types";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { MAX_PROPOSALS_PER_REQUEST } from "../types/provider-jobs.types";

const DESCRIPTION_CLAMP = "line-clamp-2 sm:line-clamp-3";

export interface JobCardProps {
  job: ProviderJobItem;
  className?: string;
}

export function JobCard({ job, className }: JobCardProps) {
  const detailPath = `/dashboard/jobs/${job.id}`;
  const linkState: JobDetailLocationState = {
    job,
    jobDetailPresentation: "sheet",
  };
  const { urls: photoUrls, isLoading: photoUrlsLoading } =
    useServiceRequestPhotoUrls(job.photos ?? null);

  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });

  const urgencyBadge = job.urgency === "high"
    ? { label: "Urgente", variant: "destructive" as const }
    : job.urgency === "medium"
      ? { label: "Média prioridade", variant: "warning" as const }
      : null;

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
                  {job.service_title}
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
              {job.exact_area_match && (
                <Badge variant="outline" className="shrink-0 gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                  <CheckCircle className="h-3 w-3" aria-hidden />
                  Sua área
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-1 w-full min-w-0 space-y-0.5 sm:mt-0 sm:hidden">
            <p className="text-xs font-medium text-muted-foreground">
              {job.service_title}
            </p>
            <h2 className="text-lg font-semibold leading-tight">
              {job.title}
            </h2>
          </div>

          {job.description && (
            <p className={cn("mt-1.5 text-sm text-muted-foreground", DESCRIPTION_CLAMP)}>
              {job.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {job.neighborhood}, {job.city}
            </span>
            <span className="font-medium text-foreground">
              {formatDistance(job.distance_km)} de você
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatRelativeDate(job.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {job.proposal_count} de {MAX_PROPOSALS_PER_REQUEST} propostas
            </span>
            <span className="text-xs">
              {job.masked_client_name}
            </span>
          </div>
        </CardHeader>

        <CardContent className="!pt-0">
          {(job.photos?.length ?? 0) > 0 && (
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
