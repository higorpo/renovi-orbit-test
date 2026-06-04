import { isPendingProposalStatus } from "@/features/negotiation-proposals/utils/proposalStatus";
import type { ServiceRequestWithRelationsRow } from "../api/serviceRequests.api";
import type {
  ServiceRequestCardModel,
  AddressSummary,
  ServiceSummary,
} from "../types/client-my-services.types";
import {
  deriveServiceRequestListPhase,
  listPhaseToStatusTabId,
} from "./serviceRequestListPhase";
import { toDescriptionPreview } from "../utils/descriptionPreview";

function mapAddress(row: ServiceRequestWithRelationsRow): AddressSummary | null {
  const addr = row.client_addresses;
  if (!addr) return null;
  const cityName = addr.platform_cities?.name ?? "";
  const stateAbbr = addr.platform_states?.abbreviation;
  const streetPart = addr.street?.trim() ? addr.street.trim() : undefined;
  const numberPart = addr.number?.trim() ? addr.number.trim() : undefined;
  const streetSummary =
    streetPart && numberPart
      ? `${streetPart}, ${numberPart}`
      : streetPart ?? numberPart ?? undefined;

  return {
    neighborhood: addr.neighborhood ?? "",
    cityName,
    stateAbbreviation: stateAbbr ?? undefined,
    streetSummary,
    street: addr.street ?? undefined,
    number: addr.number ?? undefined,
    complement: addr.complement ?? undefined,
    zipCode: addr.zip_code ?? undefined,
  };
}

function mapService(row: ServiceRequestWithRelationsRow): ServiceSummary | null {
  const svc = row.platform_services;
  if (!svc) return null;
  return {
    title: svc.title,
    slug: svc.slug,
    icon_key: svc.icon_key ?? null,
    color_key: svc.color_key ?? null,
  };
}

function mapContractedProviderName(row: ServiceRequestWithRelationsRow): string | null {
  const contracted = row.services;
  if (!contracted?.provider) return null;
  const { provider } = contracted;
  const displayName = provider.provider_profiles_public?.display_name?.trim();
  if (displayName) return displayName;
  return provider.full_name?.trim() || null;
}

export function mapToServiceRequestCardModel(
  row: ServiceRequestWithRelationsRow,
): ServiceRequestCardModel {
  const address = mapAddress(row);
  const service = mapService(row);
  const contractedServiceId = row.contracted_service_id ?? null;
  const listPhase = deriveServiceRequestListPhase({
    status: row.status,
    contractedServiceId,
  });

  const proposals = Array.isArray(row.provider_proposals) ? row.provider_proposals : [];

  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? null,
    descriptionPreview: toDescriptionPreview(row.description ?? null),
    formData:
      row.form_data && typeof row.form_data === "object" && !Array.isArray(row.form_data)
        ? (row.form_data as Record<string, unknown>)
        : null,
    formSchema:
      row.form_schema &&
      typeof row.form_schema === "object" &&
      !Array.isArray(row.form_schema)
        ? (row.form_schema as Record<string, unknown>)
        : null,
    listPhase,
    statusTabId: listPhaseToStatusTabId(listPhase),
    contractedServiceId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    address,
    service,
    photoPaths: Array.isArray(row.photos) ? row.photos : [],
    proposalCount: proposals.length,
    hasPendingClientProposal: proposals.some((proposal) =>
      isPendingProposalStatus(proposal.status),
    ),
    selectedProfessionalName: mapContractedProviderName(row),
    tags: Array.isArray(row.tags) ? row.tags : null,
    urgency: row.urgency ?? null,
    scopeComplexity: row.scope_complexity ?? null,
    estimatedDurationHint: row.estimated_duration_hint ?? null,
    missingInfoWarnings: Array.isArray(row.missing_info_warnings)
      ? row.missing_info_warnings
      : null,
  };
}
