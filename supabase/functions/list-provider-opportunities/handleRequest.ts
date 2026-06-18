import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";
import { initSentryEdge, withSpan } from "../_shared/sentrySpans.ts";
import {
  parseListProviderOpportunitiesBody,
  validateCoordinates,
  validateNearestSortRequiresCoordinates,
} from "./parseBody.ts";
import type {
  ListProviderOpportunitiesBody,
  ListProviderOpportunitiesFeedResponse,
} from "./types.ts";
import { EMPTY_FEED_RESPONSE } from "./types.ts";

const logger = createLogger("list-provider-opportunities");
const RATE_LIMIT_CONFIG = { perMinute: 60 };

export interface ProviderProfile {
  role: string;
  operational_status: string;
}

export interface ListProviderOpportunitiesDeps {
  getUser: (token: string) => Promise<{ user: { id: string } | null; error: Error | null }>;
  getProfile: (userId: string) => Promise<{ profile: ProviderProfile | null; error: Error | null }>;
  listOpportunities: (params: {
    providerId: string;
    lat: number | null;
    lng: number | null;
    sortMode: string;
    cursor: string | null;
    limit: number;
  }) => Promise<{ data: ListProviderOpportunitiesFeedResponse | null; error: { message: string; code?: string } | null }>;
  checkRateLimit: typeof checkRateLimit;
}

function resolveRequestId(req: Request): string {
  const header = req.headers.get("x-request-id")?.trim();
  return header && header.length > 0 ? header : crypto.randomUUID();
}

function isRpcValidationError(error: { code?: string; message: string }): boolean {
  return error.code === "22023" || /invalid feed cursor|nearest sort requires/i.test(error.message);
}

export async function handleListProviderOpportunitiesRequest(
  req: Request,
  deps: ListProviderOpportunitiesDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);
  const requestId = resolveRequestId(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  await initSentryEdge("list-provider-opportunities");

  return withSpan(
    "list-provider-opportunities.handle",
    "function",
    { request_id: requestId },
    async () => {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401, cors);
      }

      const token = authHeader.replace("Bearer ", "");
      const { user, error: authError } = await deps.getUser(token);
      if (authError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401, cors);
      }

      const { profile, error: profileError } = await deps.getProfile(user.id);
      if (profileError || !profile) {
        logger.error("profile_lookup_failed", { request_id: requestId, user_id: user.id });
        return jsonResponse({ error: "Failed to load profile" }, 500, cors);
      }

      if (profile.role !== "provider") {
        return jsonResponse(
          { error: "Forbidden: only providers can access this endpoint" },
          403,
          cors,
        );
      }

      if (profile.operational_status === "suspended") {
        logger.info("suspended_provider_empty_feed", { request_id: requestId, user_id: user.id });
        return jsonResponse(EMPTY_FEED_RESPONSE, 200, cors);
      }

      const clientIP = getClientIP(req);
      const rateLimit = await deps.checkRateLimit(
        clientIP,
        user.id,
        "list-provider-opportunities",
        RATE_LIMIT_CONFIG,
      );

      if (!rateLimit.allowed) {
        logger.warn("rate_limited", {
          request_id: requestId,
          user_id: user.id,
          retry_after: rateLimit.retryAfter,
        });
        return jsonResponse(
          {
            error: "rate_limited",
            message: "Too many requests. Try again shortly.",
            retryAfter: rateLimit.retryAfter,
          },
          429,
          { ...cors, "Retry-After": String(rateLimit.retryAfter) },
        );
      }

      let body: ListProviderOpportunitiesBody;
      try {
        body = await req.json() as ListProviderOpportunitiesBody;
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
      }

      const params = parseListProviderOpportunitiesBody(body);

      const coordinateError = validateCoordinates(params.lat, params.lng);
      if (coordinateError) {
        return jsonResponse({ error: coordinateError }, 400, cors);
      }

      const nearestError = validateNearestSortRequiresCoordinates(
        params.sortMode,
        params.lat,
        params.lng,
      );
      if (nearestError) {
        return jsonResponse({ error: nearestError }, 400, cors);
      }

      const { data, error: rpcError } = await deps.listOpportunities({
        providerId: user.id,
        lat: params.lat,
        lng: params.lng,
        sortMode: params.sortMode,
        cursor: params.cursor,
        limit: params.limit,
      });

      if (rpcError) {
        if (isRpcValidationError(rpcError)) {
          return jsonResponse({ error: rpcError.message }, 400, cors);
        }

        logger.error("rpc_list_provider_opportunities_failed", {
          request_id: requestId,
          user_id: user.id,
          error: rpcError.message,
        });
        return jsonResponse({ error: "Failed to fetch opportunities" }, 500, cors);
      }

      return jsonResponse(data ?? EMPTY_FEED_RESPONSE, 200, cors);
    },
  );
}
