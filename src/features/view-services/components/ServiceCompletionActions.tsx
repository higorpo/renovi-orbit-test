import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirmServiceCompleted } from "../hooks/useConfirmServiceCompleted";
import { useMarkServiceExecuted } from "../hooks/useMarkServiceExecuted";

export type ServiceCompletionViewerRole = "client" | "provider";

export type ServiceCompletionActionsProps = {
  contractedServiceId: string;
  status: string;
  viewerRole: ServiceCompletionViewerRole;
  onSuccess?: () => void;
};

export function ServiceCompletionActions({
  contractedServiceId,
  status,
  viewerRole,
  onSuccess,
}: ServiceCompletionActionsProps) {
  const markExecuted = useMarkServiceExecuted();
  const confirmCompletion = useConfirmServiceCompleted();

  const handleMarkExecuted = async () => {
    try {
      await markExecuted.mutateAsync(contractedServiceId);
      toast.success("Serviço marcado como executado.");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao marcar serviço.");
    }
  };

  const handleConfirmCompletion = async () => {
    try {
      await confirmCompletion.mutateAsync(contractedServiceId);
      toast.success("Recebimento confirmado. Obrigado!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao confirmar recebimento.");
    }
  };

  if (viewerRole === "provider" && status === "CONFIRMED") {
    return (
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={markExecuted.isPending}
        onClick={() => void handleMarkExecuted()}
      >
        {markExecuted.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          "Marcar serviço como executado"
        )}
      </Button>
    );
  }

  if (viewerRole === "client" && status === "EXECUTED") {
    return (
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={confirmCompletion.isPending}
        onClick={() => void handleConfirmCompletion()}
      >
        {confirmCompletion.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Confirmando…
          </>
        ) : (
          "Confirmar recebimento do serviço"
        )}
      </Button>
    );
  }

  return null;
}
