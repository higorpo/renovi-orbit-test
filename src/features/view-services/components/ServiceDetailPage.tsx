import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";
import { ReceivedBudgetDetailsSheet } from "@/features/negotiation-proposals";
import { useCancelService } from "../hooks/useCancelService";
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
import { SERVICE_DETAIL_PAGE_SHELL_CLASS } from "../constants/serviceDetail.constants";
import { ServiceContractedSection } from "./ServiceContractedSection";
import { ServiceDetailClientActions } from "./ServiceDetailClientActions";
import { ServiceDetailFloatingActions } from "./ServiceDetailFloatingActions";
import { ServiceDetailHeader } from "./ServiceDetailHeader";
import { ServiceDetailRequestSections } from "./ServiceDetailRequestSections";
import { ServiceProviderProposalRejectionAlert } from "./ServiceProviderProposalRejectionAlert";
import { ServiceProviderProposalSection } from "./ServiceProviderProposalSection";
import { ServiceRequestConversationList } from "@/features/chats";

interface ServiceDetailPageProps {
  serviceRequestId?: string;
  isInsideSheet?: boolean;
}

function ServiceDetailEmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-caption text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

function ServiceDetailLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-elevation-1 sm:p-6">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-muted/60" />
      </div>
      <div className="h-32 animate-pulse rounded-lg border bg-card shadow-elevation-1" />
      <div className="h-24 animate-pulse rounded-lg border bg-card shadow-elevation-1" />
    </div>
  );
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
        <ServiceDetailLoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={pageClassName}>
        <ServiceDetailEmptyState
          message="Não foi possível carregar este serviço."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!model) {
    return (
      <div className={pageClassName}>
        <ServiceDetailEmptyState message="Serviço não encontrado ou você não tem permissão para visualizá-lo." />
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
  const showClientActions =
    showClientBudgetAction || showClientNegotiationChats || (isClient && model.contracted);
  const showSecondarySections = showClientNegotiationChats || isProvider;

  return (
    <div className={pageClassName}>
      {isProvider ? (
        <ServiceProviderProposalRejectionAlert serviceRequestId={model.id} />
      ) : null}

      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1">
        <ServiceDetailHeader model={model} isClient={isClient} isProvider={isProvider} />

        {showClientActions ? (
          <div className="border-t border-border/80 px-4 py-3 sm:px-6">
            <ServiceDetailClientActions
              model={model}
              budgetAction={budgetAction}
              BudgetActionIcon={BudgetActionIcon}
              showClientBudgetAction={showClientBudgetAction}
              showClientNegotiationChats={showClientNegotiationChats}
              showContractedChat={Boolean(isClient && model.contracted)}
              contractedChatId={contractedChatId}
              cancelDialogOpen={cancelDialogOpen}
              onCancelDialogOpenChange={setCancelDialogOpen}
              onOpenBudgetSheet={() => openBudgetSheet(model)}
              onCancelService={() => cancelService(model.id)}
              isCancelling={isCancelling}
            />
          </div>
        ) : null}
      </article>

      <div className="space-y-4">
        {model.contracted ? <ServiceContractedSection contracted={model.contracted} /> : null}
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
