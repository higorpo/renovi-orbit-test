import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  canCancelContractedService,
  getCancellationDisclosure,
  type CancellationViewerRole,
} from "../utils/contractedServiceCancellation";
import { usePaymentScheduleLifecycle } from "../hooks/usePaymentScheduleLifecycle";
import { useProcessRefund } from "../hooks/useProcessRefund";

export type ContractedServiceCancelActionProps = {
  contractedServiceId: string;
  serviceStatus: string;
  scheduledStartDate: string;
  scheduledShift: string;
  viewerRole: CancellationViewerRole;
  onSuccess?: () => void;
};

export function ContractedServiceCancelAction({
  contractedServiceId,
  serviceStatus,
  scheduledStartDate,
  scheduledShift,
  viewerRole,
  onSuccess,
}: ContractedServiceCancelActionProps) {
  const [open, setOpen] = useState(false);
  const scheduleQuery = usePaymentScheduleLifecycle(contractedServiceId);
  const processRefund = useProcessRefund();
  const schedule = scheduleQuery.data;

  const eligible = canCancelContractedService({
    serviceStatus,
    scheduleState: schedule?.state,
  });

  if (scheduleQuery.isLoading || !eligible) {
    return null;
  }

  const disclosure = schedule
    ? getCancellationDisclosure({
        viewerRole,
        scheduleState: schedule.state,
        scheduledStartDate,
        scheduledShift,
        serviceExecutionAt: schedule.serviceExecutionAt,
        baseAmount: schedule.baseAmount,
        paidAmount: schedule.paidAmount,
      })
    : {
        title: "Cancelar serviço?",
        description: "O serviço será cancelado. Esta ação não pode ser desfeita.",
        confirmLabel: "Cancelar serviço",
      };

  const handleConfirm = async () => {
    try {
      const result = await processRefund.mutateAsync({
        contractedServiceId,
        cancellationReason:
          viewerRole === "provider" ? "PROVIDER_INITIATED" : "CLIENT_INITIATED",
      });

      const message =
        result.outcome === "PRE_CHARGE_CANCELLED"
          ? "Serviço cancelado com sucesso."
          : "Cancelamento solicitado. O estorno será processado em breve.";

      toast.success(message);
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao cancelar serviço.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full rounded-pill text-destructive transition-transform duration-fast ease-renovi hover:bg-destructive/5 hover:text-destructive active:scale-[0.97] sm:w-auto"
        onClick={() => setOpen(true)}
        disabled={processRefund.isPending}
      >
        Cancelar serviço
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{disclosure.title}</AlertDialogTitle>
          <AlertDialogDescription>{disclosure.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processRefund.isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={processRefund.isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {processRefund.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Cancelando…
              </>
            ) : (
              disclosure.confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
