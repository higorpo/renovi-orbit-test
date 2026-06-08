import { useServiceRequestPhotoUrls } from "@/features/request-quote";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, MapPin, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import {
  formatLocationDisplay,
  getStatusBadgeVariant,
  getStatusLabel,
  type ServiceModel,
} from "@/features/view-services";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import {
  getProviderProposalContextLabel,
  isProposalExpiringSoon,
} from "../../utils/providerProposalStatus";

export interface ProviderServiceListCardProps {
  model: ServiceModel;
  onOpenDetails?: (model: ServiceModel) => void;
  onOpenChat?: (model: ServiceModel) => void;
  className?: string;
}

export function ProviderServiceListCard({
  model,
  onOpenDetails,
  onOpenChat,
  className,
}: ProviderServiceListCardProps) {
  const locationText = formatLocationDisplay(model.address);
  const phaseVariant = getStatusBadgeVariant(model.listPhase, model.proposalCount);
  const phaseLabel = getStatusLabel(model.listPhase, model.hasPendingProposal);
  const contextLabel = getProviderProposalContextLabel(
    model.myProposal?.status,
    model.listPhase,
  );
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const { urls: photoUrls, isLoading: photoUrlsLoading } = useServiceRequestPhotoUrls(
    model.photoPaths,
  );
  const primaryPhoto = photoUrls[0];
  const extraPhotoCount = Math.max(0, photoUrls.length - 1);
  const chatId = model.chatSummary?.id ?? null;
  const lastActivityAt =
    model.lastActivityAt ?? model.myProposal?.updatedAt ?? model.updatedAt;
  const showExpiring = isProposalExpiringSoon(model.myProposal?.expiredAt);

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
                <p className="text-xs font-medium text-muted-foreground">{model.service.title}</p>
              ) : null}
              <h2 className="mt-0.5 text-lg font-semibold leading-tight">{model.title}</h2>
              {model.counterpartyName ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{model.counterpartyName}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={phaseVariant} className="shrink-0">
              {phaseLabel}
            </Badge>
            {contextLabel && contextLabel !== phaseLabel ? (
              <span className="text-xs text-muted-foreground">{contextLabel}</span>
            ) : null}
          </div>
        </div>
        {locationText ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{locationText}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {lastActivityAt ? (
            <span>Última atividade {formatRelativeDate(lastActivityAt)}</span>
          ) : null}
          {model.myProposal?.finalAmount != null ? (
            <span className="font-medium text-foreground">
              {formatCurrency(model.myProposal.finalAmount)}
            </span>
          ) : null}
          {showExpiring ? <span className="text-warning">Expira em breve</span> : null}
          {model.chatSummary?.isUnread ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              Nova mensagem
            </span>
          ) : null}
        </div>
      </CardHeader>
      {model.photoPaths.length > 0 ? (
        <CardContent className="!pt-0">
          <div className="relative inline-block">
            {photoUrlsLoading ? (
              <div className="h-16 w-16 animate-pulse rounded-md bg-muted" />
            ) : primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt=""
                className="h-16 w-16 rounded-md object-cover"
              />
            ) : null}
            {extraPhotoCount > 0 ? (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                +{extraPhotoCount}
              </span>
            ) : null}
          </div>
        </CardContent>
      ) : null}
      <CardFooter className="mt-auto border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 min-h-9 shrink-0"
                    disabled={!chatId}
                    onClick={() => onOpenChat?.(model)}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    Ver conversa
                  </Button>
                </span>
              </TooltipTrigger>
              {!chatId ? (
                <TooltipContent>Conversa ainda não disponível para este pedido</TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-h-9 shrink-0"
            onClick={() => onOpenDetails?.(model)}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Ver detalhes
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
