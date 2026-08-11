import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isManualPaymentEligible } from "../types/paymentSchedule.types";
import { usePaymentSchedule } from "../hooks/usePaymentSchedule";
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
      variant="outline"
      className={cn("w-full gap-2 rounded-pill sm:w-auto", className)}
      onClick={onClick}
      disabled={disabled}
    >
      <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
      Ajustar pagamento
    </Button>
  );
}

export type ManualPaymentRecoveryProps = {
  contractedServiceId: string;
  serviceRequestId: string;
  className?: string;
};

/** CTA + dialog only. Failure alert lives on the host page (`ManualPaymentFailureStatus`). */
export function ManualPaymentRecovery({
  contractedServiceId,
  serviceRequestId,
  className,
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
    <>
      <ManualPaymentButton
        scheduleState={scheduleState}
        onClick={() => setOpen(true)}
        disabled={scheduleQuery.isLoading}
        className={className}
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
    </>
  );
}
