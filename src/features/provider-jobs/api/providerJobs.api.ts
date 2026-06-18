import { Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  FetchProviderJobsParams,
  ProviderJobsResponse,
} from "../types/provider-jobs.types";
import {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
} from "../types/provider-jobs.types";
const INVALID_CURSOR_PATTERN = /invalid feed cursor/i;

export function isInvalidProviderJobsCursorError(error: string | null): boolean {
  return error != null && INVALID_CURSOR_PATTERN.test(error);
}

function clampFeedLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) {
    return FEED_DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), FEED_MAX_LIMIT);
}

async function fetchProgressiveProviderJobs(
  params: FetchProviderJobsParams,
  limit: number,
): Promise<{ data: ProviderJobsResponse | null; error: string | null }> {
  const cursor = params.cursor ?? null;

  return Sentry.startSpan(
    {
      name: "provider_jobs.fetch_list",
      op: "function",
      attributes: {
        "provider_jobs.sort_mode": params.sort_mode,
        "provider_jobs.has_cursor": String(Boolean(cursor)),
        feature: "provider-jobs",
        "provider_jobs.feed_source": "progressive",
      },
    },
    async () => {
      const { data, error } = await supabase.functions.invoke(
        "list-provider-opportunities",
        {
          body: {
            sort_mode: params.sort_mode,
            cursor,
            limit,
            lat: params.lat ?? null,
            lng: params.lng ?? null,
          },
        },
      );

      if (error) {
        logger.error("fetch_provider_jobs_error", { error: error.message });
        return { data: null, error: error.message };
      }

      if (data?.error) {
        const message =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : "Failed to fetch opportunities";

        logger.error("fetch_provider_jobs_api_error", { error: message });
        return { data: null, error: message };
      }

      const response = data as ProviderJobsResponse;
      return {
        data: {
          items: response.items ?? [],
          next_cursor: response.next_cursor ?? null,
          has_more: Boolean(response.has_more),
        },
        error: null,
      };
    },
  );
}

export async function fetchProviderJobs(
  params: FetchProviderJobsParams,
): Promise<{ data: ProviderJobsResponse | null; error: string | null }> {
  const limit = clampFeedLimit(params.limit);
  return fetchProgressiveProviderJobs(params, limit);
}
