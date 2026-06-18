/**
 * DISPATCH_STOPPED matching mocks for Playwright (task 57).
 */
import type { Page } from "@playwright/test";

export const E2E_DISPATCH_STOPPED_PROVIDER_ID = "provider-e2e-uuid";
export const E2E_DISPATCH_STOPPED_CLIENT_ID = "client-e2e-uuid";
export const E2E_DISPATCH_STOPPED_SR_ID = "sr-dispatch-stopped-e2e";
export const E2E_DISPATCH_STOPPED_CHAT_ID = "chat-dispatch-stopped-e2e";
export const E2E_DISPATCH_STOPPED_PROPOSAL_ID = "prop-dispatch-stopped-draft-e2e";
export const E2E_DISPATCH_STOPPED_SR_TITLE = "Serviço com matching parado E2E";

const PRICING_SIGNATURE = "e2e-pricing-signature";

function getServiceRpcPayload() {
  return {
    id: E2E_DISPATCH_STOPPED_SR_ID,
    list_phase: "negotiation",
    request: {
      title: E2E_DISPATCH_STOPPED_SR_TITLE,
      description: "Pedido com quatro propostas em andamento e dispatch parado.",
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
      id: E2E_DISPATCH_STOPPED_CLIENT_ID,
      display_name: "Cliente E2E",
    },
  };
}

function latestProposalRow() {
  return {
    id: E2E_DISPATCH_STOPPED_PROPOSAL_ID,
    service_request_id: E2E_DISPATCH_STOPPED_SR_ID,
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

function initiateConversationPayload() {
  return {
    conversation: {
      id: E2E_DISPATCH_STOPPED_CHAT_ID,
      service_request_id: E2E_DISPATCH_STOPPED_SR_ID,
      client_id: E2E_DISPATCH_STOPPED_CLIENT_ID,
      provider_id: E2E_DISPATCH_STOPPED_PROVIDER_ID,
      status: "ACTIVE",
      last_interaction_at: new Date().toISOString(),
    },
  };
}

export async function installDispatchStoppedMocks(page: Page) {
  const capturedRpc: Record<string, unknown[]> = {
    createProviderProposal: [],
    initiateConversation: [],
  };

  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    latitude: -27.5954,
    longitude: -48.548,
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
      serviceRequestFilter === `eq.${E2E_DISPATCH_STOPPED_SR_ID}` &&
      providerFilter === `eq.${E2E_DISPATCH_STOPPED_PROVIDER_ID}`
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
            pricing_signature: PRICING_SIGNATURE,
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
          body: JSON.stringify(initiateConversationPayload()),
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

  return { capturedRpc };
}
