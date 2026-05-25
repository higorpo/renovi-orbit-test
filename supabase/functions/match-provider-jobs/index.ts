/**
 * Edge Function: match-provider-jobs
 *
 * Returns eligible, ranked service requests for an authenticated provider.
 * Acts as a thin orchestration layer over the `match_provider_jobs` RPC.
 *
 * ── Flow ──────────────────────────────────────────────────────────────
 * 1. Auth & authz – validate JWT, ensure `profile.role = 'provider'`.
 * 2. Input validation – latitude/longitude bounds.
 * 3. Parallel fetch – fires three queries concurrently:
 *    a) RPC `match_provider_jobs` (core eligibility + ranking, see below)
 *    b) Provider's offered services  (UI context)
 *    c) Provider's service-area neighborhoods  (UI context)
 * 4. Response assembly – merges RPC page with provider_services and
 *    provider_area_summary (cities + neighborhoods).
 *
 * ── Eligibility criteria (RPC, all must pass) ─────────────────────────
 *  • Request status = 'open' and location is not null.
 *  • Service match – provider offers the exact service OR its parent
 *    category (hierarchical match via `services.parent_id`).
 *  • City-level area coverage – request city ∈ cities derived from
 *    `provider_service_area_neighborhoods`.
 *  • Geographic proximity – PostGIS ST_DWithin(request, provider, radius).
 *    radius_km clamped to [1, 100].
 *  • No existing active proposal from this provider on the request.
 *  • Fewer than 3 active (non-withdrawn, non-rejected) proposals total.
 *  • Optional service_id filter for single-service views.
 *
 * ── Computed fields per item ──────────────────────────────────────────
 *  • distance_km        – ST_Distance / 1000, rounded to 1 decimal.
 *  • proposal_count     – active proposals on the request.
 *  • exact_area_match   – true if request neighborhood matches one the
 *                         provider explicitly covers (not just same city).
 *  • masked_client_name – "FirstName L." for client privacy.
 *
 * ── Ranking (sort_mode) ──────────────────────────────────────────────
 *  • nearest (default)     – distance_km ASC
 *  • least_competitive     – proposal_count ASC
 *  • newest                – created_at DESC
 *  Tiebreakers: created_at DESC → distance_km ASC.
 *
 * ── Pagination ───────────────────────────────────────────────────────
 *  Offset-based: page (min 1), page_size (clamped [1, 50]).
 *  Response envelope: { items, total_count, page, page_size,
 *                       provider_services, provider_area_summary }.
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import type { MatchProviderJobsBody } from "./types.ts";

interface ProviderServiceRow {
  service_id: string;
  platform_services: {
    id: string;
    title: string;
    slug: string;
    icon_key: string | null;
    color_key: string | null;
  } | null;
}

interface AreaNeighborhoodRow {
  neighborhood_id: string;
  platform_neighborhoods: {
    id: string;
    name: string;
    city_id: string;
    platform_cities: { id: string; name: string } | null;
  } | null;
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid authorization header" },
        401,
        corsHeaders,
      );
    }

    const supabase = createServiceRoleClient();

    // Authenticate user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    // Verify provider role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "provider") {
      return jsonResponse(
        { error: "Forbidden: only providers can access this endpoint" },
        403,
        corsHeaders,
      );
    }

    // Parse and validate request body
    const body: MatchProviderJobsBody = await req.json();
    const {
      latitude,
      longitude,
      radius_km,
      service_id,
      sort_mode,
      page,
      page_size,
    } = body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return jsonResponse(
        { error: "Valid latitude (-90..90) and longitude (-180..180) are required" },
        400,
        corsHeaders,
      );
    }

    // Fetch matching jobs + provider context in parallel
    const [jobsResult, servicesResult, areaResult] = await Promise.all([
      supabase.rpc("match_provider_jobs", {
        p_provider_id: user.id,
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radius_km ?? 10,
        p_service_id: service_id ?? null,
        p_sort_mode: sort_mode ?? "nearest",
        p_page_size: page_size ?? 20,
        p_page: page ?? 1,
      }),
      supabase
        .from("provider_offered_services")
        .select("service_id, platform_services(id, title, slug, icon_key, color_key)")
        .eq("provider_id", user.id)
        .order("sort_order"),
      supabase
        .from("provider_service_area_neighborhoods")
        .select(
          "neighborhood_id, platform_neighborhoods(id, name, city_id, platform_cities(id, name))",
        )
        .eq("provider_id", user.id),
    ]);

    if (jobsResult.error) {
      console.error("RPC match_provider_jobs error:", jobsResult.error);
      return jsonResponse(
        { error: "Failed to fetch matching jobs" },
        500,
        corsHeaders,
      );
    }

    // Map provider offered services
    const providerServices = ((servicesResult.data ?? []) as unknown as ProviderServiceRow[])
      .map((row) => ({
        id: row.platform_services?.id ?? row.service_id,
        title: row.platform_services?.title ?? "",
        slug: row.platform_services?.slug ?? "",
        icon_key: row.platform_services?.icon_key ?? null,
        color_key: row.platform_services?.color_key ?? null,
      }));

    // Map provider service area
    const citiesMap = new Map<string, string>();
    const neighborhoods: string[] = [];
    for (const row of (areaResult.data ?? []) as unknown as AreaNeighborhoodRow[]) {
      const n = row.platform_neighborhoods;
      if (n?.name) neighborhoods.push(n.name);
      if (n?.platform_cities?.id && n?.platform_cities?.name) {
        citiesMap.set(n.platform_cities.id, n.platform_cities.name);
      }
    }

    const response = {
      ...(jobsResult.data as Record<string, unknown>),
      provider_services: providerServices,
      provider_area_summary: {
        cities: Array.from(citiesMap.values()),
        neighborhoods,
      },
    };

    return jsonResponse(response, 200, corsHeaders);
  } catch (err) {
    console.error("match-provider-jobs unexpected error:", err);
    return jsonResponse(
      { error: "Internal server error" },
      500,
      corsHeaders,
    );
  }
});
