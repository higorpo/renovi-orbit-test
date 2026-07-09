import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isManualPaymentEligible } from "../types/paymentSchedule.types";
import { usePaymentSchedule } from "../hooks/usePaymentSchedule";
import { ManualPaymentFailureAlert } from "./ManualPaymentFailureAlert";
import { ManualPaymentDialog } from "./ManualPaymentDialog";

export type ManualPaymentButtonProps = {
  scheduleState: string | null | undefined;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function ManualPaymentButton({
  scheduleState,
  onClick,
  disabled = false,
  className,
}: ManualPaymentButtonProps) {
  if (!scheduleState || !isManualPaymentEligible(scheduleState)) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      <CreditCard className="mr-2 h-4 w-4" aria-hidden />
      Ajustar pagamento
    </Button>
  );
}

export type ManualPaymentRecoveryProps = {
  contractedServiceId: string;
  serviceRequestId: string;
};

export function ManualPaymentRecovery({
  contractedServiceId,
  serviceRequestId,
}: ManualPaymentRecoveryProps) {
  const [open, setOpen] = useState(false);
  const scheduleQuery = usePaymentSchedule(contractedServiceId);
  const schedule = scheduleQuery.data?.schedule;
  const context = scheduleQuery.data?.context;
  const scheduleState = schedule?.state;

  if (!isManualPaymentEligible(scheduleState ?? "")) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <ManualPaymentFailureAlert scheduleState={scheduleState} />
      <ManualPaymentButton
        scheduleState={scheduleState}
        onClick={() => setOpen(true)}
        disabled={scheduleQuery.isLoading}
        className="w-full rounded-pill sm:w-auto"
      />
      {schedule && context ? (
        <ManualPaymentDialog
          open={open}
          onOpenChange={setOpen}
          schedule={schedule}
          acceptedProposalId={context.acceptedProposalId}
          serviceRequestId={serviceRequestId}
          onCompleted={() => void scheduleQuery.refetch()}
        />
      ) : null}
    </div>
  );
}
