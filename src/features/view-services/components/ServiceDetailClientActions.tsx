import type { ComponentType } from "react";
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
import type { ServiceModel } from "../types/service.types";
import type { getServiceRequestBudgetActionState } from "../utils/serviceRequestBudgetAction";

interface ServiceDetailClientActionsProps {
  model: ServiceModel;
  budgetAction: ReturnType<typeof getServiceRequestBudgetActionState> | null;
  BudgetActionIcon: ComponentType<{ className?: string }> | null;
  showClientBudgetAction: boolean;
  showClientNegotiationChats: boolean;
  showContractedChat: boolean;
  showRepublishAction: boolean;
  contractedChatId: string | null;
  cancelDialogOpen: boolean;
  onCancelDialogOpenChange: (open: boolean) => void;
  onOpenBudgetSheet: () => void;
  onCancelService: () => void;
  onRepublishService: () => void;
  isCancelling: boolean;
  isRepublishing: boolean;
}

export function ServiceDetailClientActions({
  model,
  budgetAction,
  BudgetActionIcon,
  showClientBudgetAction,
  showClientNegotiationChats,
  showContractedChat,
  showRepublishAction,
  contractedChatId,
  cancelDialogOpen,
  onCancelDialogOpenChange,
  onOpenBudgetSheet,
  onCancelService,
  onRepublishService,
  isCancelling,
  isRepublishing,
}: ServiceDetailClientActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {showRepublishAction ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full gap-1.5 rounded-pill transition-transform duration-fast ease-renovi active:scale-[0.97] sm:w-auto"
          onClick={onRepublishService}
          disabled={isRepublishing}
        >
          {isRepublishing ? "Republicando…" : "Republicar novo pedido de serviço"}
        </Button>
      ) : null}

      {showClientBudgetAction && budgetAction && BudgetActionIcon ? (
        // Deprecated: prefer ServiceNextStepCard as primary CTA; remove when next-step covers this surface.
        <Button
          type="button"
          variant={showRepublishAction ? "outline" : "default"}
          size="sm"
          className="w-full gap-1.5 rounded-pill transition-transform duration-fast ease-renovi active:scale-[0.97] sm:w-auto"
          onClick={onOpenBudgetSheet}
        >
          <BudgetActionIcon className="h-4 w-4 shrink-0" aria-hidden />
          {budgetAction.label}
        </Button>
      ) : null}

      {showContractedChat ? (
        // Deprecated: prefer ServiceNextStepCard as primary CTA; remove when next-step covers this surface.
        <ServiceRequestContractedChatButton
          chatId={contractedChatId}
          providerDisplayName={model.contracted?.provider?.displayName}
          className="w-full sm:w-auto"
        />
      ) : null}

      {showClientNegotiationChats ? (
        <AlertDialog open={cancelDialogOpen} onOpenChange={onCancelDialogOpenChange}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-pill text-destructive transition-transform duration-fast ease-renovi hover:bg-destructive/5 hover:text-destructive active:scale-[0.97] sm:ml-auto sm:w-auto"
            onClick={() => onCancelDialogOpenChange(true)}
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
                  onCancelService();
                  onCancelDialogOpenChange(false);
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
