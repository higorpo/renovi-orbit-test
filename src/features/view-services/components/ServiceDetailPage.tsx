import { useMemo } from "react";
import { FileQuestion } from "lucide-react";
import { useParams } from "react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";
import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { ManualPaymentFailureStatus } from "@/features/payments";
import { useService } from "../hooks/useService";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../utils/suggestedItemsMapper";
import { useServiceRequestBudgetSheet } from "../hooks/useServiceRequestBudgetSheet";
import { useProviderServiceRequestChat } from "../hooks/useProviderServiceRequestChat";
import { useServiceDetailChatNavigation } from "../hooks/useServiceDetailChatNavigation";
import { useRecordProviderOpportunityView } from "../hooks/useRecordProviderOpportunityView";
import { useServiceDetailNextStep } from "../hooks/useServiceDetailNextStep";
import { SERVICE_DETAIL_PAGE_SHELL_CLASS } from "../constants/serviceDetail.constants";
import { ServiceContractedSection } from "./ServiceContractedSection";
import { ServiceDetailNextStepOverlays } from "./ServiceDetailNextStepOverlays";
import { ServiceNextStepCard } from "./ServiceNextStepCard";
import { ClientServiceJourneySection } from "./ClientServiceJourneySection";
import { ServiceSupportHelpCard } from "./ServiceSupportHelpCard";
import { ServiceProviderLocationSection } from "./ServiceProviderLocationSection";
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

  const nextStep = useServiceDetailNextStep({
    model,
    role: profile?.role,
    openBudgetSheet,
    openProviderChat: openChat,
    isOpeningProviderChat: isOpeningChat,
    onCompletionSuccess: () => void refetch(),
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
  const showSecondarySections = showClientNegotiationChats || isProvider;

  return (
    <div className={pageClassName}>
      {isProvider ? (
        <ServiceProviderProposalRejectionAlert serviceRequestId={model.id} />
      ) : null}
      {isClient && model.contracted ? (
        <ManualPaymentFailureStatus contractedServiceId={model.contracted.id} />
      ) : null}

      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
        <ServiceDetailHeader
          model={model}
          isClient={isClient}
          isProvider={isProvider}
          onOpenBudgetSheet={openBudgetSheet}
          onMutated={() => void refetch()}
        />
      </article>

      <div className="space-y-4">
        {nextStep.step ? (
          <ServiceNextStepCard
            step={nextStep.step}
            onAction={nextStep.handleAction}
            disabled={nextStep.actionDisabled}
          />
        ) : null}
        {isClient ? (
          <ClientServiceJourneySection
            serviceRequestId={model.id}
            ratingOptional={model.contracted?.status === "COMPLETED"}
          />
        ) : null}
        {model.contracted ? (
          <ServiceContractedSection
            contracted={model.contracted}
            showProviderSettlement={isProvider}
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
        <ServiceSupportHelpCard />
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

      <ServiceDetailNextStepOverlays
        model={model}
        role={profile?.role}
        step={nextStep.step}
        nextStep={nextStep}
      />
    </div>
  );
}
