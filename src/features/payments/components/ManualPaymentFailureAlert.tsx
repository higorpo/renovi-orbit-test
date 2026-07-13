import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isManualPaymentEligible } from "../types/paymentSchedule.types";
import { formatManualPaymentFailureMessage } from "../utils/manualPaymentErrors";

export type ManualPaymentFailureAlertProps = {
  scheduleState: string | null | undefined;
  failureCode?: string | null;
};

export function ManualPaymentFailureAlert({
  scheduleState,
  failureCode = null,
}: ManualPaymentFailureAlertProps) {
  if (!scheduleState || !isManualPaymentEligible(scheduleState)) {
    return null;
  }

  const failureMessage = formatManualPaymentFailureMessage(null, failureCode);

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Pagamento falhou</AlertTitle>
      <AlertDescription className="mt-1.5 space-y-1.5 text-sm leading-relaxed">
        <p>{failureMessage}</p>
        <p>
          Atualize suas informações de pagamento para confirmar o serviço. Sem essa ação, o
          serviço pode ser cancelado automaticamente perto da data agendada.
        </p>
      </AlertDescription>
    </Alert>
  );
}
