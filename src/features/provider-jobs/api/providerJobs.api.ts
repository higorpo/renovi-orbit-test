import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  FetchProviderJobsParams,
  ProviderJobItem,
  ProviderJobsResponse,
} from "../types/provider-jobs.types";

export async function fetchProviderJobs(
  params: FetchProviderJobsParams,
): Promise<{ data: ProviderJobsResponse | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(
    "match-provider-jobs",
    { body: params },
  );

  if (error) {
    logger.error("fetch_provider_jobs_error", { error: error.message });
    return { data: null, error: error.message };
  }

  if (data?.error) {
    logger.error("fetch_provider_jobs_api_error", { error: data.error });
    return { data: null, error: data.error };
  }

  return { data: data as ProviderJobsResponse, error: null };
}

/**
 * Loads job detail via `get_provider_proposal_job_detail` (own proposal any status, or eligible open request).
 * Prefer {@link proposalId} when known; otherwise pass {@link serviceRequestId}.
 * {@link latitude}/{@link longitude} are required for browse (no proposal yet); used for distance when a proposal exists.
 */
export async function fetchProviderProposalJobDetail(params: {
  proposalId?: string | null;
  serviceRequestId: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;
}): Promise<{ data: ProviderJobItem | null; error: string | null }> {
  const hasProposalId = Boolean(params.proposalId);
  const { data, error } = await supabase.rpc("get_provider_proposal_job_detail", {
    p_proposal_id: hasProposalId ? params.proposalId : null,
    p_service_request_id: hasProposalId ? null : params.serviceRequestId,
    p_lat: params.latitude,
    p_lng: params.longitude,
    p_radius_km: params.radiusKm ?? 10,
  });

  if (error) {
    logger.error("fetch_provider_proposal_job_detail_error", {
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (data == null) {
    return { data: null, error: null };
  }

  return { data: data as unknown as ProviderJobItem, error: null };
}
