import type { ServiceRequestWithRelationsRow } from "../api/serviceRequests.api";
import type { ServiceRequestCardModel, AddressSummary, ServiceSummary } from "../types/client-my-services.types";
import { statusToTabId } from "../constants/statusTabs";
import type { ServiceRequestDbStatus } from "../constants/statusTabs";
import { toDescriptionPreview } from "../utils/descriptionPreview";

function mapAddress(
  row: ServiceRequestWithRelationsRow
): AddressSummary | null {
  const addr = row.client_addresses;
  if (!addr) return null;
  const cityName = addr.platform_cities?.name ?? "";
  const stateAbbr = addr.platform_states?.abbreviation;
  const streetSummary =
    addr.street && addr.number
      ? `${addr.street}, ${addr.number}`
      : addr.street ?? addr.number ?? undefined;

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

function mapService(
  row: ServiceRequestWithRelationsRow
): ServiceSummary | null {
  const svc = row.platform_services;
  if (!svc) return null;
  return {
    title: svc.title,
    slug: svc.slug,
    icon_key: svc.icon_key ?? null,
    color_key: svc.color_key ?? null,
  };
}

/**
 * Map API row to card view model.
 */
export function mapToServiceRequestCardModel(
  row: ServiceRequestWithRelationsRow
): ServiceRequestCardModel {
  const status = (row.status ?? "open") as ServiceRequestDbStatus;
  const address = mapAddress(row);
  const service = mapService(row);

  const proposals = Array.isArray(row.provider_proposals)
    ? row.provider_proposals
    : [];

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
    status,
    statusTabId: statusToTabId(status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    address,
    service,
    photoPaths: Array.isArray(row.photos) ? row.photos : [],
    proposalCount: proposals.length,
    hasSubmittedProposal: proposals.some((proposal) => proposal.status === "submitted"),
    tags: Array.isArray(row.tags) ? row.tags : null,
  };
}
