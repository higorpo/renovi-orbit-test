import type { StatusTabId } from "../constants/statusTabs";

export type ServiceListPhase = "negotiation" | "in_progress" | "completed" | "cancelled";

export interface AddressSummary {
  neighborhood: string;
  cityName: string;
  stateAbbreviation?: string;
  streetSummary?: string;
  street?: string;
  number?: string;
  complement?: string;
  zipCode?: string;
}

export interface PlatformServiceSummary {
  title: string;
  slug: string;
  icon_key?: string | null;
  color_key?: string | null;
}

export interface CounterpartySummary {
  id: string;
  displayName: string;
}

export interface ContractedServiceSummary {
  id: string;
  status: string;
  agreedSlot: Record<string, unknown> | null;
  durationUnit: string;
  durationValue: number;
  scheduledStartDate: string;
  scheduledEndDate: string | null;
  scheduledShift: string;
  provider: CounterpartySummary | null;
}

/** Unified service model for list and detail (from get_service / list_services RPCs). */
export interface ServiceModel {
  id: string;
  title: string;
  description: string | null;
  descriptionPreview: string;
  formData: Record<string, unknown> | null;
  formSchema: Record<string, unknown> | null;
  listPhase: ServiceListPhase;
  statusTabId: StatusTabId;
  contractedServiceId: string | null;
  createdAt: string;
  updatedAt: string;
  address: AddressSummary | null;
  service: PlatformServiceSummary | null;
  photoPaths: string[];
  proposalCount: number;
  hasPendingProposal: boolean;
  counterpartyName: string | null;
  counterparty: CounterpartySummary | null;
  contracted: ContractedServiceSummary | null;
  tags: string[] | null;
  urgency: string | null;
  scopeComplexity: string | null;
  estimatedDurationHint: string | null;
  missingInfoWarnings: string[] | null;
  suggestedEquipment: string[] | null;
  suggestedMaterials: string[] | null;
}

export interface ListServicesParams {
  page: number;
  pageSize: number;
  statusTabId: StatusTabId;
  search?: string | null;
  categoryId?: string | null;
  cityName?: string | null;
  neighborhoodName?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  hasImages?: boolean | null;
  hasProposals?: boolean | null;
  serviceRequestId?: string | null;
}

export interface PaginatedServicesResult {
  items: ServiceModel[];
  total_count: number;
  page: number;
  page_size: number;
}
