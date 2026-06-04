import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceRequestListPhase } from "../utils/serviceRequestListPhase";

/** Address summary for list/card display (from client_addresses + platform_cities). */
export interface AddressSummary {
  neighborhood: string;
  cityName: string;
  stateAbbreviation?: string;
  /** Street + number if safe to show in list. */
  streetSummary?: string;
  street?: string;
  number?: string;
  complement?: string;
  zipCode?: string;
}

/** Service summary for list/card (from services table). */
export interface ServiceSummary {
  title: string;
  slug: string;
  icon_key?: string | null;
  color_key?: string | null;
}

/** View model for a service request card. */
export interface ServiceRequestCardModel {
  id: string;
  title: string;
  description: string | null;
  descriptionPreview: string;
  formData: Record<string, unknown> | null;
  formSchema: Record<string, unknown> | null;
  listPhase: ServiceRequestListPhase;
  statusTabId: StatusTabId;
  contractedServiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  address: AddressSummary | null;
  service: ServiceSummary | null;
  photoPaths: string[];
  proposalCount?: number;
  hasPendingClientProposal?: boolean;
  selectedProfessionalName?: string | null;
  progressPercent?: number | null;
  tags?: string[] | null;
  urgency?: string | null;
  scopeComplexity?: string | null;
  estimatedDurationHint?: string | null;
  missingInfoWarnings?: string[] | null;
}

/** Filter state for the page. */
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
