/**
 * Progressive provider feed mocks for Playwright (matching tasks 55–56).
 * Simulates visibility-gated feed, cursor pagination, and dismiss.
 */
import type { Page } from "@playwright/test";

export const E2E_FEED_PROVIDER_ID = "provider-e2e-uuid";
export const E2E_FEED_SR_ID = "sr-feed-e2e-1";
export const E2E_FEED_JOB_TITLE = "Instalar tomada E2E";
export const E2E_FEED_PAGE_SIZE = 20;
export const E2E_FEED_PAGINATED_TOTAL = 25;

export interface CapturedFeedRequest {
  sort_mode: string;
  cursor: string | null;
  limit: number;
}

export interface ProviderFeedMockOptions {
  /** When true, the feed returns the opportunity on first request. */
  batchOpenInitially?: boolean;
  /** When true, returns 25 items across cursor pages (task 56). */
  paginatedFeed?: boolean;
}

function feedJobItem(
  overrides: {
    service_request_id?: string;
    title?: string;
    granted_at?: string;
    active_chat_count_24h?: number;
    distance_km?: number;
    source?: "batch" | "fallback";
  } = {},
) {
  return {
    service_request_id: overrides.service_request_id ?? E2E_FEED_SR_ID,
    title: overrides.title ?? E2E_FEED_JOB_TITLE,
    service_name: "Elétrica",
    service_icon_key: "Zap",
    service_color_key: "yellow_orange",
    neighborhood: "Centro",
    urgency: "medium",
    granted_at: overrides.granted_at ?? "2026-03-20T12:00:00.000Z",
    distance_km: overrides.distance_km ?? 2.5,
    active_chat_count_24h: overrides.active_chat_count_24h ?? 0,
    source: overrides.source ?? "batch",
  };
}

function paginatedCatalog() {
  return Array.from({ length: E2E_FEED_PAGINATED_TOTAL }, (_, index) => {
    const n = index + 1;
    return feedJobItem({
      service_request_id: `sr-feed-page-${n}`,
      title: `Job paginado E2E ${n}`,
      granted_at: new Date(Date.UTC(2026, 2, n)).toISOString(),
      active_chat_count_24h: E2E_FEED_PAGINATED_TOTAL - n,
      distance_km: n,
    });
  });
}

function sortCatalog(items: ReturnType<typeof feedJobItem>[], sortMode: string) {
  const sorted = [...items];
  if (sortMode === "newest") {
    sorted.sort((a, b) => b.granted_at.localeCompare(a.granted_at));
  } else if (sortMode === "least_competitive") {
    sorted.sort((a, b) => a.active_chat_count_24h - b.active_chat_count_24h);
  } else {
    sorted.sort((a, b) => a.distance_km - b.distance_km);
  }
  return sorted;
}

function cursorForPage(sortMode: string, pageIndex: number) {
  return `cursor-${sortMode}-page-${pageIndex}`;
}

function paginatedFeedResponse(sortMode: string, cursor: string | null) {
  const catalog = sortCatalog(paginatedCatalog(), sortMode);

  if (!cursor) {
    const items = catalog.slice(0, E2E_FEED_PAGE_SIZE);
    return {
      items,
      next_cursor: cursorForPage(sortMode, 2),
      has_more: true,
    };
  }

  if (cursor === cursorForPage(sortMode, 2)) {
    const items = catalog.slice(E2E_FEED_PAGE_SIZE);
    return {
      items,
      next_cursor: null,
      has_more: false,
    };
  }

  return {
    error: "Invalid feed cursor",
    message: "Invalid feed cursor",
  };
}

function getServiceRpcPayload() {
  return {
    id: E2E_FEED_SR_ID,
    list_phase: "negotiation",
    request: {
      title: E2E_FEED_JOB_TITLE,
      description: "Preciso de uma tomada nova na cozinha.",
      created_at: "2026-03-20T12:00:00.000Z",
      urgency: "medium",
      tags: ["urgente"],
      scope_complexity: "simple",
      estimated_duration_hint: "1_to_2h",
      suggested_equipment: ["drill"],
      suggested_materials: ["silicone_sealant"],
      address: {
        neighborhood: "Centro",
        city_name: "Florianópolis",
        state_abbreviation: "SC",
      },
      platform_service: {
        title: "Elétrica",
        slug: "eletrica",
        icon_key: null,
        color_key: null,
      },
    },
    negotiation: {
      proposal_count: 0,
      has_pending_proposal: false,
    },
    counterparty: {
      id: "client-e2e-uuid",
      display_name: "Maria S.",
    },
  };
}

export async function installProviderFeedMocks(
  page: Page,
  options: ProviderFeedMockOptions = {},
) {
  let batchOpen = options.batchOpenInitially ?? false;
  const paginatedFeed = options.paginatedFeed ?? false;
  const dismissedIds = new Set<string>();
  const capturedFeedRequests: CapturedFeedRequest[] = [];

  if (paginatedFeed) {
    batchOpen = true;
  }

  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    latitude: -27.5954,
    longitude: -48.548,
  });

  await page.route(/\/functions\/v1\/list-provider-opportunities/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    let body: Record<string, unknown> = {};
    try {
      body = route.request().postDataJSON() as Record<string, unknown>;
    } catch {
      const raw = route.request().postData();
      if (raw) {
        body = JSON.parse(raw) as Record<string, unknown>;
      }
    }

    const sortMode = String(body.sort_mode ?? "nearest");
    const cursor =
      typeof body.cursor === "string"
        ? body.cursor
        : body.cursor == null
          ? null
          : String(body.cursor);
    const limit = body.limit ?? E2E_FEED_PAGE_SIZE;

    capturedFeedRequests.push({ sort_mode: sortMode, cursor, limit });

    if (paginatedFeed) {
      const payload = paginatedFeedResponse(sortMode, cursor);
      const status = "error" in payload ? 400 : 200;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
      return;
    }

    const visible = batchOpen && !dismissedIds.has(E2E_FEED_SR_ID);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: visible ? [feedJobItem()] : [],
        next_cursor: null,
        has_more: false,
      }),
    });
  });

  await page.route(/\/rest\/v1\/rpc\//, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const rpcName = url.pathname.split("/").pop() ?? "";
    const body = route.request().postDataJSON() as Record<string, unknown>;

    switch (rpcName) {
      case "dismiss_provider_opportunity": {
        const serviceRequestId = String(body.p_service_request_id ?? "");
        if (serviceRequestId) {
          dismissedIds.add(serviceRequestId);
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      case "get_service":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(getServiceRpcPayload()),
        });
        return;

      case "record_provider_opportunity_view":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;

      default:
        await route.fallback();
    }
  });

  return {
    openBatch: () => {
      batchOpen = true;
    },
    isBatchOpen: () => batchOpen,
    dismissedIds,
    capturedFeedRequests,
  };
}
