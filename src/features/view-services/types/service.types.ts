import type { StatusTabId } from "../constants/statusTabs";
import type { ProposalRevisionReason, ProposalStatus } from "@/features/negotiation-proposals";

export type ServiceListPhase =
  | "negotiation"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "dispute";

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
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlatformServiceSummary {
  title: string;
  slug: string;
  icon_key?: string | null;
  color_key?: string | null;
}

import type { Database } from "@/lib/supabase/database.types";
import type { ServiceRescheduleSnapshot } from "@/features/service-reschedule";

export type PaymentScheduleState =
  Database["public"]["Enums"]["payment_schedule_state"];

/** Canonical CS lifecycle status from Postgres enum `contracted_service_status`. */
export type ContractedServiceStatus =
  Database["public"]["Enums"]["contracted_service_status"];

export interface CounterpartySummary {
  id: string;
  displayName: string;
  profileImagePath: string | null;
}

/** Contracted provider identity for detail card (extends list counterparty). */
export interface ContractedProviderSummary extends CounterpartySummary {
  slug: string | null;
}

export interface ContractedServiceSummary {
  id: string;
  status: ContractedServiceStatus;
  agreedSlot: Record<string, unknown> | null;
  durationUnit: string;
  durationValue: number;
  scheduledStartDate: string;
  scheduledEndDate: string | null;
  scheduledShift: string;
  provider: ContractedProviderSummary | null;
  chatId: string | null;
  updatedAt: string | null;
  /** Accepted proposal final amount (BRL). */
  finalAmount: number | null;
  /** Current payment_schedules.state when a schedule exists for this contracted service. */
  paymentScheduleState?: PaymentScheduleState | null;
  /** True while post-PAID far reschedule refund+recapture is in flight. */
  farRecapturePending?: boolean;
  reschedule?: ServiceRescheduleSnapshot | null;
  /** Client overall score for this contracted service; null when not rated yet. */
  clientRatingOverallScore?: number | null;
  /** When the client submitted the rating for this contracted service. */
  clientRatingSubmittedAt?: string | null;
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
  /** Enrichment FSM status from service_request_enrichments (lightweight). */
  enrichmentStatus: "PENDING" | "RUNNING" | "READY" | "ABORTED" | null;
  enrichmentReady: boolean;
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
