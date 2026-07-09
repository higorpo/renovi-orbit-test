import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PAYMENT_SCHEDULE_QUERY_KEY,
  usePaymentSchedule,
} from "@/features/payments";
import { SERVICES_LIST_QUERY_KEY } from "@/features/view-services";

/**
 * Opens ManualPaymentDialog from the client service card when payment failed permanently.
 * Fetches schedule/context only after the user opens the modal.
 */
export function useClientCardManualPayment(contractedServiceId: string | null) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const scheduleQuery = usePaymentSchedule(contractedServiceId, open);

  const openModal = useCallback(() => {
    if (!contractedServiceId) {
      toast.error("Não foi possível carregar o pagamento deste serviço.");
      return;
    }
    setOpen(true);
  }, [contractedServiceId]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  const handleCompleted = useCallback(() => {
    void scheduleQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: PAYMENT_SCHEDULE_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
  }, [queryClient, scheduleQuery]);

  useEffect(() => {
    if (!open || !scheduleQuery.isError) return;
    toast.error("Não foi possível carregar o pagamento deste serviço.");
    setOpen(false);
  }, [open, scheduleQuery.isError]);

  return {
    open,
    openModal,
    handleOpenChange,
    handleCompleted,
    schedule: scheduleQuery.data?.schedule ?? null,
    context: scheduleQuery.data?.context ?? null,
    isLoading: open && scheduleQuery.isLoading,
    error: open ? scheduleQuery.error : null,
  };
}
