import { useCancelService } from "@/features/view-services";

export function useClientMyServicesCancel() {
  const { cancelService, isCancelling } = useCancelService();

  return {
    cancelServiceRequest: cancelService,
    isCancelling,
  };
}
