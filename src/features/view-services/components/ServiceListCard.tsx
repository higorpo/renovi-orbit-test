import { useState } from "react";
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
  Eye,
  Trash2,
  GitCompare,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import { getStatusBadgeVariant, getStatusLabel } from "../constants/statusBadge";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { formatServiceDate } from "../utils/formatDate";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";
import { ServiceInsightTags } from "./ServiceInsightTags";
import type { ServiceModel } from "../types/service.types";

const DESCRIPTION_CLAMP = "line-clamp-2 sm:line-clamp-3";

export interface ServiceListCardProps {
  model: ServiceModel;
  onCancel?: (id: string) => void;
  onOpenBudgets?: (model: ServiceModel) => void;
  onOpenDetails?: (model: ServiceModel) => void;
  isCancelling?: boolean;
  className?: string;
  showCancelAction?: boolean;
}

function CardActions({
  model,
  onCancel,
  onOpenBudgets,
  onOpenDetails,
  isCancelling,
  showCancelAction,
}: {
  model: ServiceModel;
  onCancel?: (id: string) => void;
  onOpenBudgets?: (model: ServiceModel) => void;
  onOpenDetails?: (model: ServiceModel) => void;
  isCancelling?: boolean;
  showCancelAction?: boolean;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const actions: Array<{
    label: string;
    action?: "cancel" | "openBudgets" | "openDetails";
    icon: React.ComponentType<{ className?: string }>;
  }> = [{ label: "Ver detalhes", action: "openDetails", icon: Eye }];

  if ((model.proposalCount ?? 0) > 0) {
    actions.push({
      label: model.listPhase === "negotiation" ? "Comparar orçamentos" : "Histórico de orçamentos",
      action: "openBudgets",
      icon: model.listPhase === "negotiation" ? GitCompare : History,
    });
  }

  if (showCancelAction && model.listPhase === "negotiation") {
    actions.push({ label: "Cancelar pedido", action: "cancel", icon: Trash2 });
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
                  Ao cancelar, o serviço não receberá mais orçamentos. Esta ação não pode ser
                  desfeita.
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
        ) : action.action === "openBudgets" ? (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-9 min-h-9 shrink-0"
            onClick={() => onOpenBudgets?.(model)}
            aria-label={action.label}
          >
            <action.icon className="h-3.5 w-3.5" aria-hidden />
            {action.label}
          </Button>
        ) : (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-9 min-h-9 shrink-0"
            onClick={() => onOpenDetails?.(model)}
            aria-label="Ver detalhes"
          >
            <action.icon className="h-3.5 w-3.5" aria-hidden />
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}

export function ServiceListCard({
  model,
  onCancel,
  onOpenBudgets,
  onOpenDetails,
  isCancelling,
  className,
  showCancelAction = false,
}: ServiceListCardProps) {
  const locationText = formatLocationDisplay(model.address);
  const variant = getStatusBadgeVariant(model.listPhase, model.proposalCount);
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const { urls: photoUrls, isLoading: photoUrlsLoading } =
    useServiceRequestPhotoUrls(model.photoPaths);

  return (
    <Card
      className={cn("flex flex-col transition-colors hover:border-primary/30", className)}
    >
      <CardHeader className="!pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {model.service ? (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                  serviceStyle.color,
                )}
                aria-hidden
              >
                <serviceStyle.Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {model.service ? (
                <p className="hidden text-xs font-medium text-muted-foreground sm:block">
                  {model.service.title}
                </p>
              ) : null}
              <h2 className="mt-0.5 hidden text-lg font-semibold leading-tight sm:block">
                {model.title}
              </h2>
            </div>
          </div>
          <Badge variant={variant} className="shrink-0">
            {getStatusLabel(model.listPhase, model.hasPendingProposal)}
          </Badge>
        </div>
        <div className="mt-1 w-full min-w-0 space-y-0.5 sm:mt-0 sm:hidden">
          {model.service ? (
            <p className="text-xs font-medium text-muted-foreground">{model.service.title}</p>
          ) : null}
          <h2 className="text-lg font-semibold leading-tight">{model.title}</h2>
        </div>
        {model.descriptionPreview ? (
          <p className={cn("mt-1.5 text-sm text-muted-foreground", DESCRIPTION_CLAMP)}>
            {model.descriptionPreview}
          </p>
        ) : null}
        <ServiceInsightTags model={model} />
        {locationText ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{locationText}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Criado em {formatServiceDate(model.createdAt)}</span>
          {model.updatedAt !== model.createdAt ? (
            <span>Atualizado em {formatServiceDate(model.updatedAt)}</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="!pt-0">
        <ImagePreviewStrip urls={photoUrls} isLoading={photoUrlsLoading} />
        {model.listPhase === "in_progress" && model.counterpartyName ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" aria-hidden />
              Profissional: {model.counterpartyName}
            </span>
          </div>
        ) : null}
        {model.proposalCount > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {model.proposalCount} orçamento(s)
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="mt-auto border-t pt-3">
        <CardActions
          model={model}
          onCancel={onCancel}
          onOpenBudgets={onOpenBudgets}
          onOpenDetails={onOpenDetails}
          isCancelling={isCancelling}
          showCancelAction={showCancelAction}
        />
      </CardFooter>
    </Card>
  );
}
