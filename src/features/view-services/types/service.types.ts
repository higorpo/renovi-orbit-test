import type { StatusTabId } from "../constants/statusTabs";
import type { ProposalRevisionReason, ProposalStatus } from "@/features/negotiation-proposals";

export type ServiceListPhase = "negotiation" | "in_progress" | "completed" | "cancelled";

export interface MyProposalSummary {
  id: string;
  status: ProposalStatus;
  finalAmount: number;
  updatedAt: string;
  expiredAt: string | null;
  submittedAt: string | null;
  revisionReason: ProposalRevisionReason | null;
  revisionNotes: string | null;
  clientRejectionResponse: string | null;
}

export interface ServiceChatSummary {
  id: string;
  isUnread: boolean;
  lastInteractionAt: string;
  lastMessagePreview: string | null;
  /** Latest active chat provider name (client list; not the only chat on the SR). */
  providerDisplayName?: string | null;
}

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
  profileImagePath: string | null;
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
  updatedAt: string | null;
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
  requestStatus: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  address: AddressSummary | null;
  service: PlatformServiceSummary | null;
  photoPaths: string[];
  proposalCount: number;
  hasPendingProposal: boolean;
  /** PENDING proposals awaiting client decision (client list). */
  pendingProposalCount: number;
  /** Active chats on this service request (client list). */
  activeChatCount: number;
  /** Chats with unread inbound messages (client list). */
  unreadChatCount: number;
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
  lastActivityAt: string | null;
  myProposal: MyProposalSummary | null;
  chatSummary: ServiceChatSummary | null;
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
