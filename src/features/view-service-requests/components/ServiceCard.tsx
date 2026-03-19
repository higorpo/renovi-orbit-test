import { useState } from "react";
import { Link } from "react-router";
import { useServiceRequestPhotoUrls } from "@/features/request-quote";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  MapPin,
  MessageSquare,
  Wrench,
  Pencil,
  Eye,
  Trash2,
  Activity,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import type { ServiceRequestCardModel } from "../types/service-request-view.types";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "../constants/statusBadge";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { formatServiceRequestDate } from "../utils/formatDate";
import { getServiceDetailPath } from "../constants/routes";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";

const DESCRIPTION_CLAMP = "line-clamp-2 sm:line-clamp-3";

/** Statuses that allow the user to exclude (cancel) the service. */
const CANCELLABLE_STATUSES = ["open"] as const;
const CANCELLABLE_STATUS_TABS = ["waiting_proposals", "negotiation"] as const;

function canCancelService(model: ServiceRequestCardModel): boolean {
  return (
    CANCELLABLE_STATUSES.includes(model.status as "open") ||
    CANCELLABLE_STATUS_TABS.includes(model.statusTabId as "negotiation")
  );
}

export interface ServiceCardProps {
  model: ServiceRequestCardModel;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
  className?: string;
}

function CardActions({
  model,
  onCancel,
  isCancelling,
}: {
  model: ServiceRequestCardModel;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}) {
  const detailPath = getServiceDetailPath(model.id);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const actions: Array<{
    label: string;
    href?: string;
    action?: "cancel";
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  switch (model.status) {
    case "open":
      actions.push(
        { label: "Editar serviço", href: detailPath, icon: Pencil },
        { label: "Ver detalhes", href: detailPath, icon: Eye }
      );
      if (canCancelService(model)) {
        actions.push({ label: "Cancelar serviço", action: "cancel", icon: Trash2 });
      }
      break;
    case "in_progress":
      actions.push(
        { label: "Ver serviço", href: detailPath, icon: Eye },
        { label: "Ver atividades", href: detailPath, icon: Activity }
      );
      break;
    case "closed":
      actions.push(
        { label: "Ver detalhes", href: detailPath, icon: Eye },
        { label: "Avaliar profissional", href: detailPath, icon: Star }
      );
      break;
    case "cancelled":
      actions.push({ label: "Ver detalhes", href: detailPath, icon: Eye });
      break;
    default:
      actions.push({ label: "Ver detalhes", href: detailPath, icon: Eye });
      if (canCancelService(model)) {
        actions.push({ label: "Cancelar serviço", action: "cancel", icon: Trash2 });
      }
  }

  const handleConfirmCancel = () => {
    onCancel?.(model.id);
    setDeleteDialogOpen(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) =>
        action.action === "cancel" ? (
          <AlertDialog
            key={action.label}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-9 shrink-0"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isCancelling}
              aria-label="Cancelar serviço"
            >
              <action.icon className="h-3.5 w-3.5" aria-hidden />
              {action.label}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao cancelar, o serviço não receberá mais propostas. Esta
                  ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Fechar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmCancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isCancelling ? "Cancelando…" : "Cancelar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-9 min-h-9 shrink-0"
            asChild
          >
            <Link to={action.href!} className="inline-flex items-center gap-1.5">
              <action.icon className="h-3.5 w-3.5" aria-hidden />
              {action.label}
            </Link>
          </Button>
        )
      )}
    </div>
  );
}

export function ServiceCard({
  model,
  onCancel,
  isCancelling,
  className,
}: ServiceCardProps) {
  const locationText = formatLocationDisplay(model.address);
  const variant = STATUS_BADGE_VARIANT[model.status];
  const detailPath = getServiceDetailPath(model.id);
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const { urls: photoUrls, isLoading: photoUrlsLoading } =
    useServiceRequestPhotoUrls(model.photoPaths);

  return (
    <Card
      className={cn(
        "flex flex-col transition-colors hover:border-primary/30",
        className
      )}
    >
      <Link
        to={detailPath}
        className="contents"
        aria-label={`Ver detalhes do serviço: ${model.title}`}
      >
        <CardHeader className="!pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {model.service && (
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                    serviceStyle.color
                  )}
                  aria-hidden
                >
                  <serviceStyle.Icon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {/* Desktop: category and title next to icon (original layout) */}
                {model.service && (
                  <p className="hidden text-xs font-medium text-muted-foreground sm:block">
                    {model.service.title}
                  </p>
                )}
                <h2 className="mt-0.5 hidden text-lg font-semibold leading-tight sm:block">
                  {model.title}
                </h2>
              </div>
            </div>
            <Badge variant={variant} className="shrink-0">
              {STATUS_LABELS[model.status]}
            </Badge>
          </div>
          {/* Mobile only: service name and title below, full card width */}
          <div className="mt-1 w-full min-w-0 space-y-0.5 sm:mt-0 sm:hidden">
            {model.service && (
              <p className="text-xs font-medium text-muted-foreground">
                {model.service.title}
              </p>
            )}
            <h2 className="text-lg font-semibold leading-tight">
              {model.title}
            </h2>
          </div>
          {model.descriptionPreview && (
            <p
              className={cn(
                "mt-1.5 text-sm text-muted-foreground",
                DESCRIPTION_CLAMP
              )}
            >
              {model.descriptionPreview}
            </p>
          )}
          {locationText && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{locationText}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Criado em {formatServiceRequestDate(model.createdAt)}</span>
            {model.updatedAt !== model.createdAt && (
              <span>Atualizado em {formatServiceRequestDate(model.updatedAt)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="!pt-0">
          <ImagePreviewStrip urls={photoUrls} isLoading={photoUrlsLoading} />
          {model.status === "in_progress" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {model.selectedProfessionalName && (
                <span className="flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" aria-hidden />
                  Profissional: {model.selectedProfessionalName}
                </span>
              )}
              {model.progressPercent != null && (
                <span>Progresso: {model.progressPercent}%</span>
              )}
            </div>
          )}
          {model.proposalCount != null && model.proposalCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {model.proposalCount} proposta(s)
            </p>
          )}
        </CardContent>
      </Link>
      <CardFooter className="mt-auto border-t pt-3">
        <CardActions
          model={model}
          onCancel={onCancel}
          isCancelling={isCancelling}
        />
      </CardFooter>
    </Card>
  );
}
