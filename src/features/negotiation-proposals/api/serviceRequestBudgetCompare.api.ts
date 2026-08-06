import { getServiceById } from "@/features/view-services";
import type { ServiceModel } from "@/features/view-services";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import { rejectProposal } from "./proposals.api";
import { parseProposalSuggestedSlots } from "../utils/parseProposalSuggestedSlots";
import type {
  ServiceRequestBudgetCompareDetail,
  ServiceRequestBudgetCompareProposal,
} from "../types/serviceRequestBudgetCompare.types";

const BUDGET_COMPARE_PROPOSAL_SELECT =
  "id, provider_id, proposed_amount, revision_count, status, created_at, submitted_at, proposal_description, proposal_suggested_slots, photos, profiles!provider_proposals_provider_id_fkey(full_name, profile_image_path)" as const;

interface BudgetCompareProposalRow {
  id: string;
  provider_id: string;
  proposed_amount: number;
  revision_count: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
  proposal_description: string;
  proposal_suggested_slots: unknown;
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

interface ProviderRatingSummaryRow {
  provider_id: string;
  rating_avg: number | null;
  rating_count: number;
  completed_services_count: number;
}

const EMPTY_RATING_SUMMARY: Omit<ProviderRatingSummaryRow, "provider_id"> = {
  rating_avg: null,
  rating_count: 0,
  completed_services_count: 0,
};

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

function parseRatingSummaries(data: unknown): Map<string, ProviderRatingSummaryRow> {
  const rows = Array.isArray(data) ? data : [];
  const map = new Map<string, ProviderRatingSummaryRow>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const providerId = record.provider_id;
    if (typeof providerId !== "string" || !providerId) continue;

    const ratingCount = Number(record.rating_count) || 0;
    const rawAvg = record.rating_avg;
    const parsedAvg =
      typeof rawAvg === "number"
        ? rawAvg
        : typeof rawAvg === "string"
          ? Number(rawAvg)
          : NaN;
    const ratingAvg =
      ratingCount > 0 && Number.isFinite(parsedAvg) ? parsedAvg : null;

    map.set(providerId, {
      provider_id: providerId,
      rating_avg: ratingAvg,
      rating_count: ratingCount,
      completed_services_count: Number(record.completed_services_count) || 0,
    });
  }

  return map;
}

function mapProposalRow(
  row: BudgetCompareProposalRow,
  publicProfile: ProviderPublicProfileRow | undefined,
  ratingSummary: ProviderRatingSummaryRow | undefined,
): ServiceRequestBudgetCompareProposal {
  const profile = resolveProfile(row.profiles);
  const displayName = publicProfile?.display_name?.trim();
  const fullName = profile?.full_name?.trim();
  const ratings = ratingSummary ?? { provider_id: row.provider_id, ...EMPTY_RATING_SUMMARY };

  return {
    id: row.id,
    provider_id: row.provider_id,
    provider_name: displayName || fullName || "Prestador",
    provider_slug: publicProfile?.slug ?? null,
    provider_profile_image_path: profile?.profile_image_path ?? null,
    rating_avg: ratings.rating_avg,
    rating_count: ratings.rating_count,
    completed_services_count: ratings.completed_services_count,
    proposed_amount: row.proposed_amount,
    revision_count: row.revision_count ?? 0,
    status: row.status,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    proposal_description: row.proposal_description,
    proposal_suggested_slots: parseProposalSuggestedSlots(row.proposal_suggested_slots),
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
  let ratingSummaries = new Map<string, ProviderRatingSummaryRow>();

  if (providerIds.length > 0) {
    const [publicResult, ratingsResult] = await Promise.all([
      supabase
        .from("provider_profiles_public")
        .select("provider_id, slug, display_name")
        .in("provider_id", providerIds),
      supabase.rpc("get_provider_rating_summaries", {
        p_provider_ids: providerIds,
      }),
    ]);

    if (publicResult.error) {
      logger.error("fetch_service_request_budget_compare_provider_profiles_error", {
        error: publicResult.error.message,
        serviceRequestId,
      });
      return { budgets: [], error: publicResult.error.message };
    }

    if (ratingsResult.error) {
      logger.error("fetch_service_request_budget_compare_rating_summaries_error", {
        error: ratingsResult.error.message,
        serviceRequestId,
      });
      return { budgets: [], error: ratingsResult.error.message };
    }

    publicProfiles = new Map(
      (publicResult.data ?? []).map((row) => [row.provider_id, row as ProviderPublicProfileRow]),
    );
    ratingSummaries = parseRatingSummaries(ratingsResult.data);
  }

  return {
    budgets: rows.map((row) =>
      mapProposalRow(
        row,
        publicProfiles.get(row.provider_id),
        ratingSummaries.get(row.provider_id),
      ),
    ),
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
