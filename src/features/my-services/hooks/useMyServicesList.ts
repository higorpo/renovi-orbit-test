import { useServicesList } from "@/features/view-services";
import type { StatusTabId } from "@/features/view-services";

export interface UseMyServicesListParams {
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
  enabled?: boolean;
}

export function useMyServicesList(params: UseMyServicesListParams) {
  return useServicesList(params);
}

/** @deprecated Use useMyServicesList */
export const useClientMyServicesList = useMyServicesList;
