import type { StatusTabId } from "@/features/view-services";

export interface MyServicesFilterState {
  statusTabId: StatusTabId;
  searchQuery: string;
  categoryId: string | null;
  cityName: string | null;
  neighborhoodName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasProposals: boolean | null;
  hasImages: boolean | null;
}

/** @deprecated Use MyServicesFilterState */
export type ServiceRequestsFilterState = MyServicesFilterState;
