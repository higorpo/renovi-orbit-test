import { useMemo, useState } from "react";
import { FileQuestion } from "lucide-react";
import { useParams } from "react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";
import {
  EnrichmentProcessingBanner,
  deriveEnrichmentProcessingUi,
  useServiceCompletionContext,
} from "@/features/service-completion";
import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { useCancelService } from "../hooks/useCancelService";
import { useRepublishCancelledService } from "../hooks/useRepublishCancelledService";
import { useService } from "../hooks/useService";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import {
  getServiceRequestBudgetActionIcon,
  getServiceRequestBudgetActionState,
} from "../utils/serviceRequestBudgetAction";
import { useServiceRequestBudgetSheet } from "../hooks/useServiceRequestBudgetSheet";
import { useProviderServiceRequestChat } from "../hooks/useProviderServiceRequestChat";
import { useServiceDetailChatNavigation } from "../hooks/useServiceDetailChatNavigation";
import { useRecordProviderOpportunityView } from "../hooks/useRecordProviderOpportunityView";
import { SERVICE_DETAIL_PAGE_SHELL_CLASS } from "../constants/serviceDetail.constants";
import { ServiceContractedSection } from "./ServiceContractedSection";
import { ServiceProviderLocationSection } from "./ServiceProviderLocationSection";
import { ServiceDetailClientActions } from "./ServiceDetailClientActions";
import { ServiceDetailFloatingActions } from "./ServiceDetailFloatingActions";
import { ServiceDetailHeader } from "./ServiceDetailHeader";
import { ServiceDetailRequestSections } from "./ServiceDetailRequestSections";
import { ServiceProviderProposalRejectionAlert } from "./ServiceProviderProposalRejectionAlert";
import { ServiceProviderProposalSection } from "./ServiceProviderProposalSection";
import { ServiceDetailSkeleton } from "./ServiceDetailSkeleton";
import { ServiceRequestConversationList } from "@/features/chats";

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
  useRecordProviderOpportunityView(id);
  const { data: model, isLoading, isError, refetch } = useService(id);
  const { data: completionContext } = useServiceCompletionContext(id, {
    pollWhileProcessing: true,
    requestStatus: model?.requestStatus ?? null,
    listPhase: model?.listPhase ?? null,
  });
  const { cancelService, isCancelling } = useCancelService();
  const { republishCancelledService, isRepublishing } = useRepublishCancelledService();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const {
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    openBudgetSheet,
  } = useServiceRequestBudgetSheet();

  const isClient = profile?.role === "client";
  const isProvider = profile?.role === "provider";

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

  const pageClassName = cn(
    SERVICE_DETAIL_PAGE_SHELL_CLASS,
    "space-y-4",
    isInsideSheet ? "px-0 py-0 pb-24 md:pb-28" : "pb-24 md:pb-28",
  );

  if (isLoading) {
    return (
      <div className={pageClassName}>
        <ServiceDetailSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={pageClassName}>
        <ErrorState
          title="Não foi possível carregar este serviço"
          description="Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com o suporte."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!model) {
    return (
      <div className={pageClassName}>
        <EmptyState
          icon={FileQuestion}
          title="Serviço não encontrado"
          description="Este serviço não existe ou você não tem permissão para visualizá-lo."
          ariaLabel="Serviço não encontrado"
        />
      </div>
    );
  }

  const showClientNegotiationChats =
    isClient && model.listPhase === "negotiation" && !model.contracted;
  const contractedChatId = model.contracted?.chatId ?? null;
  const budgetAction = isClient ? getServiceRequestBudgetActionState(model) : null;
  const BudgetActionIcon = budgetAction
    ? getServiceRequestBudgetActionIcon(model.listPhase)
    : null;
  const showClientBudgetAction = Boolean(budgetAction && !budgetAction.disabled);
  const showRepublishAction = isClient && model.listPhase === "cancelled";
  const showClientActions =
    showClientBudgetAction ||
    showClientNegotiationChats ||
    showRepublishAction ||
    (isClient && model.contracted);
  const showSecondarySections = showClientNegotiationChats || isProvider;

  const enrichmentStatus =
    completionContext?.enrichment?.status ?? model.enrichmentStatus;
  const enrichmentReady =
    completionContext?.enrichment?.status === "READY" || model.enrichmentReady;
  const enrichmentBannerUi = deriveEnrichmentProcessingUi({
    enrichmentStatus,
    enrichmentReady,
    requestStatus: model.requestStatus,
    listPhase: model.listPhase,
  });

  return (
    <div className={pageClassName}>
      {isProvider ? (
        <ServiceProviderProposalRejectionAlert serviceRequestId={model.id} />
      ) : null}

      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
        <ServiceDetailHeader model={model} isClient={isClient} isProvider={isProvider} />

        {enrichmentBannerUi.kind !== "hidden" ? (
          <div className="border-t border-border/80 px-4 py-3 sm:px-6">
            <EnrichmentProcessingBanner
              enrichmentStatus={enrichmentStatus}
              enrichmentReady={enrichmentReady}
              requestStatus={model.requestStatus}
              listPhase={model.listPhase}
            />
          </div>
        ) : null}

        {showClientActions ? (
          <div className="border-t border-border/80 px-4 py-3 sm:px-6">
            <ServiceDetailClientActions
              model={model}
              budgetAction={budgetAction}
              BudgetActionIcon={BudgetActionIcon}
              showClientBudgetAction={showClientBudgetAction}
              showClientNegotiationChats={showClientNegotiationChats}
              showContractedChat={Boolean(isClient && model.contracted)}
              showRepublishAction={showRepublishAction}
              contractedChatId={contractedChatId}
              cancelDialogOpen={cancelDialogOpen}
              onCancelDialogOpenChange={setCancelDialogOpen}
              onOpenBudgetSheet={() => openBudgetSheet(model)}
              onCancelService={() => cancelService(model.id)}
              onRepublishService={() => republishCancelledService(model.id)}
              isCancelling={isCancelling}
              isRepublishing={isRepublishing}
            />
          </div>
        ) : null}
      </article>

      <div className="space-y-4">
        {model.contracted ? (
          <ServiceContractedSection
            contracted={model.contracted}
            serviceRequestId={model.id}
            showManualPayment={Boolean(isClient)}
            showProviderSettlement={isProvider}
            showServiceCancellation={Boolean(isClient || isProvider)}
            cancellationViewerRole={
              isClient ? "client" : isProvider ? "provider" : undefined
            }
            onCancellationSuccess={() => void refetch()}
            onRescheduleSuccess={() => void refetch()}
            onCompletionSuccess={() => void refetch()}
          />
        ) : null}
        {isProvider && model.contracted ? (
          <ServiceProviderLocationSection address={model.address} />
        ) : null}
        <ServiceDetailRequestSections
          model={model}
          suggestedEquipmentPt={suggestedEquipmentPt}
          suggestedMaterialsPt={suggestedMaterialsPt}
        />
      </div>

      {showSecondarySections ? (
        <div className="space-y-4 border-t border-border/80 pt-4">
          {showClientNegotiationChats ? (
            <ServiceRequestConversationList serviceRequestId={model.id} />
          ) : null}
          {isProvider ? <ServiceProviderProposalSection serviceRequestId={model.id} /> : null}
        </div>
      ) : null}

      {isProvider ? (
        <ServiceDetailFloatingActions
          hasExistingChat={Boolean(providerChat?.chatId)}
          isInsideSheet={isInsideSheet}
          isOpeningChat={isOpeningChat}
          onOpenChat={openChat}
        />
      ) : null}

      {isClient ? (
        <ReceivedBudgetDetailsSheet
          open={budgetSheetOpen}
          serviceRequestId={selectedServiceRequestId}
          sheetMode={selectedBudgetSheetMode}
          onOpenChange={(next) => {
            if (!next) setBudgetSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
