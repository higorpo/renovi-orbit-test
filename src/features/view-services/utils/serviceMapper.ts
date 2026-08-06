import { statusToTabId } from "../constants/statusTabs";
import type {
  ProposalRevisionReason,
  ProposalStatus,
} from "@/features/negotiation-proposals";
import type {
  AddressSummary,
  ContractedServiceStatus,
  ContractedServiceSummary,
  CounterpartySummary,
  PlatformServiceSummary,
  ServiceListPhase,
  ServiceModel,
} from "../types/service.types";
import { mapRescheduleSnapshot } from "@/features/service-reschedule";
import { toDescriptionPreview } from "./descriptionPreview";

export interface RpcServiceAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  city_name?: string | null;
  state_abbreviation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RpcServicePlatformService {
  title?: string;
  slug?: string;
  icon_key?: string | null;
  color_key?: string | null;
}

export interface RpcServiceRequest {
  title?: string | null;
  description?: string | null;
  form_data?: unknown;
  form_schema?: unknown;
  photos?: string[] | null;
  created_at?: string;
  updated_at?: string;
  status?: string | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  urgency?: string | null;
  tags?: string[] | null;
  scope_complexity?: string | null;
  estimated_duration_hint?: string | null;
  missing_info_warnings?: string[] | null;
  suggested_equipment?: string[] | null;
  suggested_materials?: string[] | null;
  contracted_service_id?: string | null;
  address?: RpcServiceAddress | null;
  platform_service?: RpcServicePlatformService | null;
}

export interface RpcServiceNegotiation {
  proposal_count?: number;
  has_pending_proposal?: boolean;
  last_activity_at?: string;
  my_proposal?: {
    id?: string;
    status?: string;
    final_amount?: number;
    updated_at?: string;
    expired_at?: string | null;
    submitted_at?: string | null;
    revision_reason?: string | null;
    revision_notes?: string | null;
    client_rejection_response?: string | null;
  } | null;
  chat?: {
    id?: string;
    is_unread?: boolean;
    last_interaction_at?: string;
    last_message_preview?: string | null;
    provider_display_name?: string | null;
  } | null;
  pending_proposal_count?: number;
  chat_count?: number;
  unread_chat_count?: number;
}

export interface RpcContractedProvider {
  id?: string;
  display_name?: string | null;
}

export interface RpcContractedService {
  id?: string;
  status?: string;
  agreed_slot?: unknown;
  duration_unit?: string;
  duration_value?: number;
  scheduled_start_date?: string;
  scheduled_end_date?: string | null;
  scheduled_shift?: string;
  updated_at?: string | null;
  chat_id?: string | null;
  payment_schedule_state?: string | null;
  far_recapture_pending?: boolean | null;
  provider?: RpcContractedProvider | null;
  reschedule?: unknown;
}

export interface RpcCounterparty {
  id?: string;
  display_name?: string | null;
  profile_image_path?: string | null;
}

export interface RpcServiceRow {
  id: string;
  list_phase?: string;
  enrichment_status?: string | null;
  enrichment_ready?: boolean | null;
  executed_late?: boolean | null;
  request?: RpcServiceRequest;
  negotiation?: RpcServiceNegotiation;
  contracted?: RpcContractedService | null;
  counterparty?: RpcCounterparty | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapAddress(address: RpcServiceAddress | null | undefined): AddressSummary | null {
  if (!address) return null;
  const streetPart = address.street?.trim() ? address.street.trim() : undefined;
  const numberPart = address.number?.trim() ? address.number.trim() : undefined;
  const streetSummary =
    streetPart && numberPart
      ? `${streetPart}, ${numberPart}`
      : streetPart ?? numberPart ?? undefined;

  return {
    neighborhood: address.neighborhood ?? "",
    cityName: address.city_name ?? "",
    stateAbbreviation: address.state_abbreviation ?? undefined,
    streetSummary,
    street: address.street ?? undefined,
    number: address.number ?? undefined,
    complement: address.complement ?? undefined,
    zipCode: address.zip_code ?? undefined,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
  };
}

function mapPlatformService(
  platformService: RpcServicePlatformService | null | undefined,
): PlatformServiceSummary | null {
  if (!platformService?.title || !platformService.slug) return null;
  return {
    title: platformService.title,
    slug: platformService.slug,
    icon_key: platformService.icon_key ?? null,
    color_key: platformService.color_key ?? null,
  };
}

function mapCounterparty(counterparty: RpcCounterparty | null | undefined): CounterpartySummary | null {
  if (!counterparty?.id) return null;
  return {
    id: counterparty.id,
    displayName: counterparty.display_name?.trim() || "—",
    profileImagePath: counterparty.profile_image_path?.trim() || null,
  };
}

function mapContracted(contracted: RpcContractedService | null | undefined): ContractedServiceSummary | null {
  if (!contracted?.id || !contracted.status) return null;
  return {
    id: contracted.id,
    status: contracted.status as ContractedServiceStatus,
    agreedSlot: isRecord(contracted.agreed_slot) ? contracted.agreed_slot : null,
    durationUnit: contracted.duration_unit ?? "",
    durationValue: contracted.duration_value ?? 0,
    scheduledStartDate: contracted.scheduled_start_date ?? "",
    scheduledEndDate: contracted.scheduled_end_date ?? null,
    scheduledShift: contracted.scheduled_shift ?? "",
    provider: mapCounterparty(contracted.provider),
    chatId: contracted.chat_id ?? null,
    updatedAt: contracted.updated_at ?? null,
    paymentScheduleState: (contracted.payment_schedule_state as ContractedServiceSummary["paymentScheduleState"]) ?? null,
    farRecapturePending: Boolean(contracted.far_recapture_pending),
    reschedule: mapRescheduleSnapshot(contracted.reschedule),
  };
}

function normalizeListPhase(value: string | undefined): ServiceListPhase {
  const normalized = (value ?? "").trim().toLowerCase();
  if (
    normalized === "negotiation" ||
    normalized === "in_progress" ||
    normalized === "completed" ||
    normalized === "cancelled"
  ) {
    return normalized;
  }
  return "negotiation";
}

function mapMyProposal(
  raw: RpcServiceNegotiation["my_proposal"],
): ServiceModel["myProposal"] {
  if (!raw?.id || !raw.status) return null;
  return {
    id: raw.id,
    status: raw.status as ProposalStatus,
    finalAmount: raw.final_amount ?? 0,
    updatedAt: raw.updated_at ?? "",
    expiredAt: raw.expired_at ?? null,
    submittedAt: raw.submitted_at ?? null,
    revisionReason: (raw.revision_reason as ProposalRevisionReason | null) ?? null,
    revisionNotes: raw.revision_notes?.trim() || null,
    clientRejectionResponse: raw.client_rejection_response?.trim() || null,
  };
}

function mapChatSummary(
  raw: RpcServiceNegotiation["chat"],
): ServiceModel["chatSummary"] {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    isUnread: raw.is_unread ?? false,
    lastInteractionAt: raw.last_interaction_at ?? "",
    lastMessagePreview: raw.last_message_preview?.trim() || null,
    providerDisplayName: raw.provider_display_name?.trim() || null,
  };
}

function normalizeEnrichmentStatus(
  value: string | null | undefined,
): ServiceModel["enrichmentStatus"] {
  const normalized = (value ?? "").trim().toUpperCase();
  if (
    normalized === "PENDING" ||
    normalized === "RUNNING" ||
    normalized === "READY" ||
    normalized === "ABORTED"
  ) {
    return normalized;
  }
  return null;
}

export function mapRpcServiceRow(row: RpcServiceRow): ServiceModel {
  const request = row.request ?? {};
  const negotiation = row.negotiation ?? {};
  const listPhase = normalizeListPhase(row.list_phase);
  const address = mapAddress(request.address);
  const service = mapPlatformService(request.platform_service);
  const counterparty = mapCounterparty(row.counterparty);
  const contracted = mapContracted(row.contracted);
  const enrichmentStatus = normalizeEnrichmentStatus(row.enrichment_status);

  return {
    id: row.id,
    title: request.title ?? "",
    description: request.description ?? null,
    descriptionPreview: toDescriptionPreview(request.description ?? null),
    formData: isRecord(request.form_data) ? request.form_data : null,
    formSchema: isRecord(request.form_schema) ? request.form_schema : null,
    listPhase,
    statusTabId: statusToTabId(listPhase),
    contractedServiceId: request.contracted_service_id ?? contracted?.id ?? null,
    createdAt: request.created_at ?? "",
    updatedAt: request.updated_at ?? "",
    requestStatus: request.status ?? null,
    cancelledAt: request.cancelled_at ?? null,
    completedAt: request.completed_at ?? null,
    address,
    service,
    photoPaths: Array.isArray(request.photos) ? request.photos : [],
    proposalCount: negotiation.proposal_count ?? 0,
    hasPendingProposal: negotiation.has_pending_proposal ?? false,
    pendingProposalCount: negotiation.pending_proposal_count ?? 0,
    activeChatCount: negotiation.chat_count ?? 0,
    unreadChatCount: negotiation.unread_chat_count ?? 0,
    counterpartyName: counterparty?.displayName ?? contracted?.provider?.displayName ?? null,
    counterparty,
    contracted,
    tags: Array.isArray(request.tags) ? request.tags : null,
    urgency: request.urgency ?? null,
    scopeComplexity: request.scope_complexity ?? null,
    estimatedDurationHint: request.estimated_duration_hint ?? null,
    missingInfoWarnings: Array.isArray(request.missing_info_warnings)
      ? request.missing_info_warnings
      : null,
    suggestedEquipment: Array.isArray(request.suggested_equipment)
      ? request.suggested_equipment
      : null,
    suggestedMaterials: Array.isArray(request.suggested_materials)
      ? request.suggested_materials
      : null,
    lastActivityAt: negotiation.last_activity_at ?? null,
    myProposal: mapMyProposal(negotiation.my_proposal),
    chatSummary: mapChatSummary(negotiation.chat),
    enrichmentStatus,
    enrichmentReady: Boolean(row.enrichment_ready) || enrichmentStatus === "READY",
    executedLate:
      typeof row.executed_late === "boolean" ? row.executed_late : null,
  };
}
