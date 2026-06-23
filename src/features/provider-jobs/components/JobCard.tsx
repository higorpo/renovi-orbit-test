import { Link, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Briefcase, Clock, Eye, Loader2, MapPin, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import {
  createProviderJobsServiceDetailState,
  getServiceDetailPath,
  getUrgencyConfig,
} from "@/features/view-services";
import type { ListProviderOpportunityItem } from "../types/provider-jobs.types";
import { getJobCardPresentation } from "../utils/jobCardPresentation";

const META_ROW_CLASS =
  "flex items-center gap-1.5 text-sm font-normal leading-snug text-muted-foreground";

export interface JobCardProps {
  job: ListProviderOpportunityItem;
  className?: string;
  onDismiss?: (serviceRequestId: string) => void;
  isDismissing?: boolean;
}

function ServiceCategoryBadge({ job }: { job: ListProviderOpportunityItem }) {
  const serviceStyle = getServiceCardStyle({
    icon_key: job.service_icon_key,
    color_key: job.service_color_key,
  });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          serviceStyle.color,
        )}
        aria-hidden
      >
        <serviceStyle.Icon className="h-4 w-4" />
      </div>
      <p className="truncate text-sm font-semibold text-foreground">{job.service_name}</p>
    </div>
  );
}

function JobCardMenu({
  serviceRequestId,
  onDismiss,
  isDismissing,
}: {
  serviceRequestId: string;
  onDismiss: (serviceRequestId: string) => void;
  isDismissing: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-transform duration-150 ease-out hover:text-foreground active:scale-[0.97]"
            aria-label="Mais opções"
            disabled={isDismissing}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[11rem]">
          <DropdownMenuItem
            disabled={isDismissing}
            className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            <X className="h-4 w-4 text-destructive" aria-hidden />
            Não tenho interesse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ocultar esta oportunidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Este pedido sairá da sua lista de oportunidades. Você ainda pode acessar os
              detalhes por link direto, mas ele não voltará a aparecer aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDismissing}>Manter na lista</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDismissing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDismiss(serviceRequestId);
                setConfirmOpen(false);
              }}
            >
              {isDismissing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  Ocultando…
                </>
              ) : (
                "Não tenho interesse"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function JobCard({ job, className, onDismiss, isDismissing = false }: JobCardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const detailPath = getServiceDetailPath(job.service_request_id);
  const linkState = createProviderJobsServiceDetailState(location);
  const presentation = getJobCardPresentation(job);
  const urgencyBadge = presentation.showUrgency ? getUrgencyConfig(job.urgency) : null;

  const handleOpenDetails = () => {
    navigate(detailPath, { state: linkState });
  };

  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-0 shadow-sm transition-[box-shadow,border-color] duration-150 hover:border-border hover:shadow-md",
        className,
      )}
    >
      <div className="flex w-full min-w-0 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <ServiceCategoryBadge job={job} />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {presentation.showFallbackBadge ? (
              <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px]">
                <Briefcase className="h-3 w-3" aria-hidden />
                Mercado aberto
              </Badge>
            ) : null}
            {urgencyBadge ? (
              <Badge variant={urgencyBadge.variant} className="px-1.5 py-0.5 text-[10px]">
                {urgencyBadge.label}
              </Badge>
            ) : null}
            {onDismiss ? (
              <JobCardMenu
                serviceRequestId={job.service_request_id}
                onDismiss={onDismiss}
                isDismissing={isDismissing}
              />
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="-mx-1 flex w-full min-w-0 flex-col gap-2.5 rounded-lg px-1 py-0.5 text-left text-sm font-normal transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={handleOpenDetails}
          aria-label={`Ver detalhes: ${job.title}`}
        >
          <div className="flex flex-col gap-1">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
              {job.title}
            </h2>
            {presentation.description ? (
              <p className="line-clamp-2 text-sm leading-snug text-foreground/75">
                {presentation.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <p className={META_ROW_CLASS}>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{presentation.locationLine}</span>
            </p>
            <p className={META_ROW_CLASS}>
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{presentation.publishedLine}</span>
            </p>
          </div>
        </button>
      </div>

      <div className="mt-auto min-w-0 border-t border-border/60 px-4 pb-4 pt-3">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-10 min-h-10 w-full rounded-full bg-primary px-4 font-medium text-primary-foreground transition-transform duration-150 ease-out hover:bg-primary/90 active:scale-[0.97] sm:h-9 sm:min-h-9 sm:w-auto"
            asChild
          >
            <Link to={detailPath} state={linkState} className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4 shrink-0" aria-hidden />
              Ver detalhes
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
