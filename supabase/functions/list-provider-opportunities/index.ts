/**
 * Edge Function: list-provider-opportunities
 *
 * Thin orchestration layer over `list_provider_opportunities` RPC.
 * JWT validation, provider role check, optional rate limit, cursor feed proxy.
 */

import "xhr";
import { serve } from "std/http/server";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleListProviderOpportunitiesRequest,
  type ListProviderOpportunitiesDeps,
} from "./handleRequest.ts";
import type { ListProviderOpportunitiesFeedResponse } from "./types.ts";

function createDeps(): ListProviderOpportunitiesDeps {
  const supabase = createServiceRoleClient();

  return {
    getUser: async (token) => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      return { user, error: error ?? null };
    },
    getProfile: async (userId) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, operational_status")
        .eq("id", userId)
        .single();
      return { profile: data, error: error ?? null };
    },
    listOpportunities: async (params) => {
      const { data, error } = await supabase.rpc("list_provider_opportunities", {
        p_provider_id: params.providerId,
        p_lat: params.lat ?? undefined,
        p_lng: params.lng ?? undefined,
        p_sort_mode: params.sortMode,
        p_cursor: params.cursor ?? undefined,
        p_limit: params.limit,
      });
      return {
        data: data as ListProviderOpportunitiesFeedResponse | null,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
    checkRateLimit,
  };
}

serve((req) => handleListProviderOpportunitiesRequest(req, createDeps()));
