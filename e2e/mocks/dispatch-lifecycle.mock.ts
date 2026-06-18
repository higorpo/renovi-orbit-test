/**
 * Dispatch lifecycle mocks for Playwright (matching task 76).
 * Simulates fallback marketplace, DISPATCH_EXPIRED, PAUSED, and STOPPED feed gates.
 */
import type { Page } from "@playwright/test";

export const E2E_DISPATCH_LIFECYCLE_PROVIDER_ID = "provider-dispatch-lifecycle-e2e";
export const E2E_DISPATCH_LIFECYCLE_SR_ID = "sr-dispatch-lifecycle-e2e";
export const E2E_DISPATCH_LIFECYCLE_JOB_TITLE = "Serviço dispatch lifecycle E2E";
export const E2E_DISPATCH_LIFECYCLE_CLIENT_ID = "client-dispatch-lifecycle-e2e";
export const E2E_DISPATCH_LIFECYCLE_CHAT_ID = "chat-dispatch-lifecycle-e2e";
export const E2E_DISPATCH_LIFECYCLE_PROPOSAL_ID = "prop-dispatch-lifecycle-draft-e2e";

export type DispatchLifecycleFeedMode =
  | "empty"
  | "fallback"
  | "batch"
  | "expired_batch_persisted"
  | "expired_no_lazy";

export interface DispatchLifecycleMockOptions {
  initialFeedMode?: DispatchLifecycleFeedMode;
  /** When false, expiry hides lazy fallback (no prior batch visibility). */
  batchVisibilityBeforeExpiry?: boolean;
}

function opportunityItem(source: "batch" | "fallback") {
  return {
    service_request_id: E2E_DISPATCH_LIFECYCLE_SR_ID,
    title: E2E_DISPATCH_LIFECYCLE_JOB_TITLE,
    service_name: "Elétrica",
    service_icon_key: "Zap",
    service_color_key: "yellow_orange",
    neighborhood: "Centro",
    urgency: "medium",
    granted_at: "2026-03-20T12:00:00.000Z",
    distance_km: 2.5,
    active_chat_count_24h: 0,
    source,
  };
}

function feedItemsForMode(mode: DispatchLifecycleFeedMode) {
  switch (mode) {
    case "fallback":
      return [opportunityItem("fallback")];
    case "batch":
    case "expired_batch_persisted":
      return [opportunityItem("batch")];
    case "empty":
    case "expired_no_lazy":
    default:
      return [];
  }
}

function getServiceRpcPayload() {
  return {
    id: E2E_DISPATCH_LIFECYCLE_SR_ID,
    list_phase: "negotiation",
    request: {
      title: E2E_DISPATCH_LIFECYCLE_JOB_TITLE,
      description: "Pedido para validar gates de dispatch no E2E.",
      created_at: "2026-03-20T12:00:00.000Z",
      urgency: "medium",
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
      proposal_count: 4,
      has_pending_proposal: false,
    },
    counterparty: {
      id: E2E_DISPATCH_LIFECYCLE_CLIENT_ID,
      display_name: "Cliente E2E",
    },
  };
}

function latestProposalRow() {
  return {
    id: E2E_DISPATCH_LIFECYCLE_PROPOSAL_ID,
    service_request_id: E2E_DISPATCH_LIFECYCLE_SR_ID,
    status: "PENDING",
    proposed_amount: 450,
    tax_rate: 0.15,
    tax_amount: 67.5,
    proposal_description: "Escopo inicial para revisão.",
    photos: [],
    client_rejection_response: null,
    revision_reason: null,
    revision_notes: null,
    proposal_duration_value: 2,
    proposal_duration_unit: "hours",
    proposal_suggested_slots: [
      {
        start_date: "2026-06-20",
        shift: "morning",
      },
    ],
    version: 1,
  };
}

export async function installDispatchLifecycleMocks(
  page: Page,
  options: DispatchLifecycleMockOptions = {},
) {
  let feedMode: DispatchLifecycleFeedMode = options.initialFeedMode ?? "empty";
  let batchCount = feedMode === "batch" || feedMode === "expired_batch_persisted" ? 1 : 0;
  let dispatchPaused = false;
  const batchVisibilityBeforeExpiry = options.batchVisibilityBeforeExpiry ?? true;
  const capturedFeedRequests: Array<{ sort_mode: string; cursor: string | null }> = [];
  const capturedRpc: Record<string, unknown[]> = {
    createProviderProposal: [],
    initiateConversation: [],
  };

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

    capturedFeedRequests.push({ sort_mode: sortMode, cursor });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: feedItemsForMode(feedMode),
        next_cursor: null,
        has_more: false,
      }),
    });
  });

  await page.route(/\/rest\/v1\/provider_proposals/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const serviceRequestFilter = url.searchParams.get("service_request_id");
    const providerFilter = url.searchParams.get("provider_id");

    if (
      serviceRequestFilter === `eq.${E2E_DISPATCH_LIFECYCLE_SR_ID}` &&
      providerFilter === `eq.${E2E_DISPATCH_LIFECYCLE_PROVIDER_ID}`
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(latestProposalRow()),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route(/\/rest\/v1\/chats/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
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
      case "dismiss_provider_opportunity":
        feedMode = "empty";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;

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

      case "calculate_provider_service_pricing":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            original_amount: 450,
            tax_rate: 0.15,
            tax_amount: 67.5,
            final_amount: 382.5,
            pricing_signature: "e2e-pricing-signature",
          }),
        });
        return;

      case "create_provider_proposal":
        capturedRpc.createProviderProposal.push(body);
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "P0001",
            message: "DISPATCH_STOPPED",
            details: JSON.stringify({ code: "DISPATCH_STOPPED" }),
            hint: null,
          }),
        });
        return;

      case "cns_initiate_conversation":
        capturedRpc.initiateConversation.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversation: {
              id: E2E_DISPATCH_LIFECYCLE_CHAT_ID,
              service_request_id: E2E_DISPATCH_LIFECYCLE_SR_ID,
              client_id: E2E_DISPATCH_LIFECYCLE_CLIENT_ID,
              provider_id: E2E_DISPATCH_LIFECYCLE_PROVIDER_ID,
              status: "ACTIVE",
              last_interaction_at: new Date().toISOString(),
            },
          }),
        });
        return;

      case "list_provider_proposal_history":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
        return;

      default:
        await route.fallback();
    }
  });

  return {
    getFeedMode: () => feedMode,
    getBatchCount: () => batchCount,
    isPaused: () => dispatchPaused,
    openFallbackMarket: () => {
      feedMode = "fallback";
    },
    expireDispatch: () => {
      feedMode = batchVisibilityBeforeExpiry ? "expired_batch_persisted" : "expired_no_lazy";
    },
    pauseDispatch: () => {
      dispatchPaused = true;
      if (batchCount === 0) {
        batchCount = 1;
        feedMode = "batch";
      }
    },
    simulateCronSecondBatch: () => {
      if (dispatchPaused) {
        return { batchOpened: false, batchCount };
      }
      batchCount += 1;
      if (feedMode === "empty") {
        feedMode = "batch";
      }
      return { batchOpened: true, batchCount };
    },
    capturedFeedRequests,
    capturedRpc,
  };
}
