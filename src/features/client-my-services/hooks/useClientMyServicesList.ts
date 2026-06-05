import { useServicesList } from "@/features/view-services";
import type { StatusTabId } from "@/features/view-services";

export interface UseClientMyServicesListParams {
  statusTabId: StatusTabId;
  search: string;
  categoryId: string | null;
  cityName: string | null;
  neighborhoodName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasProposals: boolean | null;
  hasImages: boolean | null;
  serviceRequestId: string | null;
}

export function useClientMyServicesList(params: UseClientMyServicesListParams) {
  return useServicesList(params);
}
