import { useState } from "react";
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
import { ServiceRequestContractedChatButton } from "@/features/chats";
import {
  ClientEvaluateServiceAction,
  ProviderMarkExecutedAction,
} from "@/features/service-completion";
import {
  ContractedServiceCancelAction,
  ManualPaymentRecovery,
} from "@/features/payments";
import { ContractedServiceRescheduleAction } from "@/features/service-reschedule";
import { cn } from "@/lib/utils";
import { useCancelService } from "../hooks/useCancelService";
import { useRepublishCancelledService } from "../hooks/useRepublishCancelledService";
import type { ServiceModel } from "../types/service.types";
import {
  getServiceRequestBudgetActionIcon,
  getServiceRequestBudgetActionState,
} from "../utils/serviceRequestBudgetAction";
import { SERVICE_DETAIL_ACTION_BUTTON_CLASS } from "../constants/serviceDetail.constants";
import { RefreshCcw, X } from "lucide-react";

export interface ServiceDetailActionsBarProps {
  model: ServiceModel;
  isClient: boolean;
  isProvider: boolean;
  onOpenBudgetSheet?: (model: ServiceModel) => void;
  onMutated?: () => void;
  className?: string;
}

/**
 * Unified detail CTAs (negotiation + contracted). Owns cancel/republish mutations.
 * Budget sheet stays on the page (shared with next-step).
 */
export function ServiceDetailActionsBar({
  model,
  isClient,
  isProvider,
  onOpenBudgetSheet,
  onMutated,
  className,
}: ServiceDetailActionsBarProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const { cancelService, isCancelling } = useCancelService();
  const { republishCancelledService, isRepublishing } = useRepublishCancelledService();

  const contracted = model.contracted;
  const budgetAction = isClient ? getServiceRequestBudgetActionState(model) : null;
  const BudgetActionIcon = budgetAction
    ? getServiceRequestBudgetActionIcon(model.listPhase)
    : null;
  const showBudgetAction = Boolean(budgetAction && !budgetAction.disabled && onOpenBudgetSheet);
  const showRepublish = isClient && model.listPhase === "cancelled";
  const showCancelRequest =
    isClient && model.listPhase === "negotiation" && !model.contracted;
  const showContractedChat = Boolean(isClient && contracted);
  const showManualPayment = Boolean(isClient && contracted);
  const showContractedCancel = Boolean(contracted && (isClient || isProvider));

  const hasAnyAction =
    showRepublish ||
    showBudgetAction ||
    showContractedChat ||
    showCancelRequest ||
    (isProvider && contracted) ||
    (isClient && contracted) ||
    showManualPayment ||
    showContractedCancel;

  if (!hasAnyAction) return null;

  const outlineActionClass = cn(
    SERVICE_DETAIL_ACTION_BUTTON_CLASS,
    "border-border bg-background text-foreground hover:bg-muted/60",
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
      data-testid="service-detail-actions-bar"
    >
      {showRepublish ? (
        <Button
          type="button"
          variant="default"
          className={SERVICE_DETAIL_ACTION_BUTTON_CLASS}
          onClick={() => republishCancelledService(model.id)}
          disabled={isRepublishing}
        >
          <RefreshCcw className="h-4 w-4 shrink-0" aria-hidden />
          {isRepublishing ? "Republicando…" : "Republicar este pedido de serviço"}
        </Button>
      ) : null}

      {showBudgetAction && budgetAction && BudgetActionIcon ? (
        <Button
          type="button"
          variant={showRepublish ? "outline" : "default"}
          className={
            showRepublish ? outlineActionClass : SERVICE_DETAIL_ACTION_BUTTON_CLASS
          }
          onClick={() => onOpenBudgetSheet?.(model)}
        >
          <BudgetActionIcon className="h-4 w-4 shrink-0" aria-hidden />
          {budgetAction.label}
        </Button>
      ) : null}

      {isProvider && contracted ? (
        <ProviderMarkExecutedAction
          serviceRequestId={model.id}
          contractedStatus={contracted.status}
          enrichmentReady={model.enrichmentReady}
          scheduledStartDate={contracted.scheduledStartDate}
          scheduledEndDate={contracted.scheduledEndDate}
          onExecuted={onMutated}
          className={SERVICE_DETAIL_ACTION_BUTTON_CLASS}
        />
      ) : null}

      {isClient && contracted ? (
        <ClientEvaluateServiceAction
          serviceRequestId={model.id}
          contractedStatus={contracted.status}
          onCompleted={onMutated}
          className={SERVICE_DETAIL_ACTION_BUTTON_CLASS}
        />
      ) : null}

      {showManualPayment && contracted ? (
        <ManualPaymentRecovery
          contractedServiceId={contracted.id}
          serviceRequestId={model.id}
          className={outlineActionClass}
        />
      ) : null}

      {contracted && (isClient || isProvider) ? (
        <ContractedServiceRescheduleAction
          contractedServiceId={contracted.id}
          chatId={contracted.chatId}
          viewerRole={isClient ? "client" : "provider"}
          reschedule={contracted.reschedule}
          onSuccess={onMutated}
          className={outlineActionClass}
        />
      ) : null}

      {showContractedChat && contracted ? (
        <ServiceRequestContractedChatButton
          chatId={contracted.chatId}
          providerDisplayName={contracted.provider?.displayName}
          className={outlineActionClass}
        />
      ) : null}

      {showContractedCancel && contracted ? (
        <ContractedServiceCancelAction
          contractedServiceId={contracted.id}
          serviceStatus={contracted.status}
          scheduledStartDate={contracted.scheduledStartDate ?? ""}
          scheduledShift={contracted.scheduledShift ?? "morning"}
          viewerRole={isClient ? "client" : "provider"}
          onSuccess={onMutated}
          className={outlineActionClass}
        />
      ) : null}

      {showCancelRequest ? (
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              outlineActionClass,
              "text-foreground hover:bg-muted/60",
            )}
            onClick={() => setCancelDialogOpen(true)}
            disabled={isCancelling}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancelar pedido de serviço
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
      ) : null}
    </div>
  );
}

export function ServiceDetailActionsBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}
      data-testid="service-detail-actions-bar-skeleton"
      aria-hidden
    >
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted sm:w-44" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted sm:w-36" />
    </div>
  );
}
