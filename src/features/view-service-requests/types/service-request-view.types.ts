import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceRequestDbStatus } from "../constants/statusTabs";

/** Address summary for list/card display (from client_addresses + platform_cities). */
export interface AddressSummary {
  neighborhood: string;
  cityName: string;
  stateAbbreviation?: string;
  /** Street + number if safe to show in list. */
  streetSummary?: string;
}

/** Service summary for list/card (from services table). */
export interface ServiceSummary {
  title: string;
  slug: string;
}

/** View model for a service request card. */
export interface ServiceRequestCardModel {
  id: string;
  title: string;
  description: string | null;
  descriptionPreview: string;
  status: ServiceRequestDbStatus;
  statusTabId: StatusTabId;
  createdAt: string;
  updatedAt: string;
  address: AddressSummary | null;
  service: ServiceSummary | null;
  photoPaths: string[];
  /** When backend supports it. */
  proposalCount?: number;
  /** When backend supports it. */
  selectedProfessionalName?: string | null;
  /** Optional progress 0–100 when in_progress. */
  progressPercent?: number | null;
}

/** Filter state for the page. */
export interface ServiceRequestsFilterState {
  statusTabId: StatusTabId;
  searchQuery: string;
  /** Service slug or title for category filter. */
  categoryId: string | null;
  /** City name for location filter. */
  cityName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasProposals: boolean | null;
  hasImages: boolean | null;
}
