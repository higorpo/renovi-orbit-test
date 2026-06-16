import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { AlertTriangle, Clock, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { useAuth } from "@/features/auth";
import { getStatusBadgeVariant, getStatusLabel } from "../constants/statusBadge";
import { getUrgencyConfig } from "../constants/serviceDetail.constants";
import { useCancelService } from "../hooks/useCancelService";
import { useService } from "../hooks/useService";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { formatLocationDisplay } from "../utils/locationDisplay";
import {
  ServiceRequestContractedChatButton,
  ServiceRequestConversationList,
} from "@/features/chats";
import { useProviderServiceRequestChat } from "../hooks/useProviderServiceRequestChat";
import { useServiceDetailChatNavigation } from "../hooks/useServiceDetailChatNavigation";
import { ServiceContractedSection } from "./ServiceContractedSection";
import { ServiceDetailFloatingActions } from "./ServiceDetailFloatingActions";
import { ServiceDetailMetadataBadges } from "./ServiceDetailMetadataBadges";
import { ServiceDetailRequestSections } from "./ServiceDetailRequestSections";
import { ServiceProviderProposalRejectionAlert } from "./ServiceProviderProposalRejectionAlert";
import { ServiceProviderProposalSection } from "./ServiceProviderProposalSection";
interface ServiceDetailPageProps {
  serviceRequestId?: string;
  isInsideSheet?: boolean;
}

export function ServiceDetailPage({
  serviceRequestId: serviceRequestIdProp,
  isInsideSheet = false,
}: ServiceDetailPageProps = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = serviceRequestIdProp ?? routeId;
  const { profile } = useAuth();
  const { data: model, isLoading, isError, refetch } = useService(id);
  const { cancelService, isCancelling } = useCancelService();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const isClient = profile?.role === "client";
  const isProvider = profile?.role === "provider";
  const serviceStyle = getServiceCardStyle(model?.service ?? undefined);

  const { data: providerChat } = useProviderServiceRequestChat(isProvider ? id : undefined);
  const { openChat, isOpeningChat } = useServiceDetailChatNavigation({
    serviceRequestId: id ?? "",
    existingChatId: providerChat?.chatId ?? null,
  });

  const suggestedEquipmentPt = useMemo(
    () => mapSuggestedEquipmentToPt(model?.suggestedEquipment ?? null),
    [model?.suggestedEquipment],
  );
  const suggestedMaterialsPt = useMemo(
    () => mapSuggestedMaterialsToPt(model?.suggestedMaterials ?? null),
    [model?.suggestedMaterials],
  );

  if (isLoading) {
    return (
      <div className="container max-w-4xl px-4 py-6">
        <p className="text-sm text-muted-foreground">Carregando detalhes do serviço…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container max-w-4xl px-4 py-6 space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Não foi possível carregar este serviço.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="container max-w-4xl px-4 py-6 space-y-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Serviço não encontrado ou você não tem permissão para visualizá-lo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const urgencyConfig = getUrgencyConfig(model.urgency);
  const locationLine = formatLocationDisplay(model.address);
  const showClientNegotiationChats =
    isClient && model.listPhase === "negotiation" && !model.contracted;
  const contractedChatId = model.contracted?.chatId ?? null;

  return (
    <div
      className={cn(
        "container max-w-4xl space-y-4 px-4 py-6",
        isInsideSheet ? "px-0 py-0 pb-24 md:pb-28" : "pb-24 md:pb-28",
      )}
    >
      {isProvider ? <ServiceProviderProposalRejectionAlert serviceRequestId={model.id} /> : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            {model.service ? (
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  serviceStyle.color,
                )}
                aria-hidden
              >
                <serviceStyle.Icon className="h-6 w-6" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {model.service ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {model.service.title}
                </p>
              ) : null}
              <h1 className="mt-0.5 text-xl font-bold leading-tight sm:text-2xl">
                {model.title}
              </h1>
            </div>
            <Badge
              variant={getStatusBadgeVariant(model.listPhase, model.proposalCount)}
              className="shrink-0"
            >
              {getStatusLabel(model.listPhase, model.hasPendingProposal)}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {urgencyConfig ? (
              <Badge variant={urgencyConfig.variant} className="gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {urgencyConfig.label}
              </Badge>
            ) : null}
            {isClient ? (
              <Badge
                variant="outline"
                className="gap-1 border-border/80 font-normal text-muted-foreground"
              >
                <MessageSquare className="h-3 w-3 opacity-80" aria-hidden />
                {model.proposalCount}{" "}
                {model.proposalCount === 1 ? "orçamento" : "orçamentos"}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {locationLine ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {locationLine}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {formatRelativeDate(model.createdAt)}
            </span>
          </div>

          {isProvider && model.counterpartyName ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Solicitante: {model.counterpartyName}
            </p>
          ) : null}
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-4">
          <ServiceDetailMetadataBadges model={model} />

          {model.contracted ? (
            <ServiceContractedSection contracted={model.contracted} />
          ) : null}

          <ServiceDetailRequestSections
            model={model}
            suggestedEquipmentPt={suggestedEquipmentPt}
            suggestedMaterialsPt={suggestedMaterialsPt}
          />

          {showClientNegotiationChats ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={isCancelling}
                >
                  Cancelar pedido
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
                      onClick={() => {
                        cancelService(model.id);
                        setCancelDialogOpen(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isCancelling ? "Cancelando…" : "Cancelar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}

          {isClient && model.contracted ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <ServiceRequestContractedChatButton
                chatId={contractedChatId}
                providerDisplayName={model.contracted.provider?.displayName}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showClientNegotiationChats ? (
        <Card>
          <CardContent className="pt-6">
            <ServiceRequestConversationList serviceRequestId={model.id} />
          </CardContent>
        </Card>
      ) : null}

      {isProvider ? <ServiceProviderProposalSection serviceRequestId={model.id} /> : null}

      {isProvider ? (
        <ServiceDetailFloatingActions
          hasExistingChat={Boolean(providerChat?.chatId)}
          isInsideSheet={isInsideSheet}
          isOpeningChat={isOpeningChat}
          onOpenChat={openChat}
        />
      ) : null}
    </div>
  );
}
