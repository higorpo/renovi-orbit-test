import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isManualPaymentEligible } from "../types/paymentSchedule.types";

export type ManualPaymentFailureAlertProps = {
  scheduleState: string | null | undefined;
};

export function ManualPaymentFailureAlert({
  scheduleState,
}: ManualPaymentFailureAlertProps) {
  if (!scheduleState || !isManualPaymentEligible(scheduleState)) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">Pagamento falhou</AlertTitle>
      <AlertDescription className="mt-1.5 text-sm leading-relaxed">
        Atualize suas informações de pagamento para confirmar o serviço. Sem essa ação, o
        serviço pode ser cancelado automaticamente perto da data agendada.
      </AlertDescription>
    </Alert>
  );
}
