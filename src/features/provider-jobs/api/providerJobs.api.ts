import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  FetchProviderJobsParams,
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
