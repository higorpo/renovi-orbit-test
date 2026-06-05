import type { StatusTabId } from "@/features/view-services";

export interface ServiceRequestsFilterState {
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
