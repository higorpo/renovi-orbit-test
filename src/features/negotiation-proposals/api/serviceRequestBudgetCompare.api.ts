import { getServiceById } from "@/features/view-services";
import type { ServiceModel } from "@/features/view-services";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import { rejectProposal } from "./proposals.api";
import type {
  ServiceRequestBudgetCompareDetail,
  ServiceRequestBudgetCompareProposal,
} from "../types/serviceRequestBudgetCompare.types";

const BUDGET_COMPARE_PROPOSAL_SELECT =
  "id, provider_id, proposed_amount, status, created_at, submitted_at, proposal_description, photos, profiles!provider_proposals_provider_id_fkey(full_name, profile_image_path)" as const;

interface BudgetCompareProposalRow {
  id: string;
  provider_id: string;
  proposed_amount: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
  proposal_description: string;
  photos: string[] | null;
  profiles:
    | {
        full_name: string;
        profile_image_path: string | null;
      }
    | {
        full_name: string;
        profile_image_path: string | null;
      }[]
    | null;
}

interface ProviderPublicProfileRow {
  provider_id: string;
  slug: string;
  display_name: string | null;
}

function resolveProfile(
  profiles: BudgetCompareProposalRow["profiles"],
): { full_name: string; profile_image_path: string | null } | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

function mapServiceToCompareRequest(
  service: ServiceModel,
): ServiceRequestBudgetCompareDetail["service_request"] {
  return {
    id: service.id,
    title: service.title,
    description: service.description,
    status: service.listPhase,
    created_at: service.createdAt,
    service_title: service.service?.title ?? "",
    service_slug: service.service?.slug ?? "",
    service_icon_key: service.service?.icon_key ?? null,
    service_color_key: service.service?.color_key ?? null,
    neighborhood: service.address?.neighborhood ?? null,
    city: service.address?.cityName ?? null,
    state_abbr: service.address?.stateAbbreviation ?? null,
  };
}

function mapProposalRow(
  row: BudgetCompareProposalRow,
  publicProfile: ProviderPublicProfileRow | undefined,
): ServiceRequestBudgetCompareProposal {
  const profile = resolveProfile(row.profiles);
  const displayName = publicProfile?.display_name?.trim();
  const fullName = profile?.full_name?.trim();

  return {
    id: row.id,
    provider_id: row.provider_id,
    provider_name: displayName || fullName || "Prestador",
    provider_slug: publicProfile?.slug ?? null,
    provider_profile_image_path: profile?.profile_image_path ?? null,
    proposed_amount: row.proposed_amount,
    status: row.status,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    proposal_description: row.proposal_description,
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}

async function fetchBudgetCompareProposals(
  serviceRequestId: string,
): Promise<{ budgets: ServiceRequestBudgetCompareProposal[]; error: string | null }> {
  const { data, error } = await supabase
    .from("provider_proposals")
    .select(BUDGET_COMPARE_PROPOSAL_SELECT)
    .eq("service_request_id", serviceRequestId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("fetch_service_request_budget_compare_proposals_error", {
      error: error.message,
      serviceRequestId,
    });
    return { budgets: [], error: error.message };
  }

  const rows = (data ?? []) as BudgetCompareProposalRow[];
  const providerIds = [...new Set(rows.map((row) => row.provider_id))];

  let publicProfiles = new Map<string, ProviderPublicProfileRow>();
  if (providerIds.length > 0) {
    const { data: publicRows, error: publicError } = await supabase
      .from("provider_profiles_public")
      .select("provider_id, slug, display_name")
      .in("provider_id", providerIds);

    if (publicError) {
      logger.error("fetch_service_request_budget_compare_provider_profiles_error", {
        error: publicError.message,
        serviceRequestId,
      });
      return { budgets: [], error: publicError.message };
    }

    publicProfiles = new Map(
      (publicRows ?? []).map((row) => [row.provider_id, row as ProviderPublicProfileRow]),
    );
  }

  return {
    budgets: rows.map((row) => mapProposalRow(row, publicProfiles.get(row.provider_id))),
    error: null,
  };
}

export async function fetchServiceRequestBudgetCompareDetail(serviceRequestId: string): Promise<{
  data: ServiceRequestBudgetCompareDetail | null;
  error: string | null;
}> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID do pedido é obrigatório" };
  }

  const [serviceResult, proposalsResult] = await Promise.all([
    getServiceById(id),
    fetchBudgetCompareProposals(id),
  ]);

  if (serviceResult.error) {
    return { data: null, error: serviceResult.error };
  }
  if (proposalsResult.error) {
    return { data: null, error: proposalsResult.error };
  }
  if (!serviceResult.data) {
    return { data: null, error: "Pedido não encontrado" };
  }

  return {
    data: {
      service_request: mapServiceToCompareRequest(serviceResult.data),
      budgets: proposalsResult.budgets,
    },
    error: null,
  };
}

export async function rejectServiceRequestBudgetProposal(params: {
  proposalId: string;
  reason: string;
  idempotencyKey?: string;
}) {
  const result = await rejectProposal({
    proposalId: params.proposalId,
    rejectionReason: params.reason,
    idempotencyKey: params.idempotencyKey,
  });

  if (result.error) {
    return { error: result.error.message, data: null as unknown };
  }

  return { error: null, data: result.data };
}
