/**
 * Manual payment recovery mocks for Playwright (Task 96).
 */
import type { Page } from "@playwright/test";
import {
  E2E_CHAT_ID,
  E2E_CLIENT_ID,
  E2E_PROVIDER_ID,
} from "./chats.mock";
import { E2E_PAYMENT_TOKEN_ID } from "./payments.mock";

export const E2E_MANUAL_SR_ID = "sr-manual-payment-e2e";
export const E2E_MANUAL_SR_TITLE = "Serviço com pagamento manual E2E";
export const E2E_CONTRACTED_SERVICE_ID = "cs-manual-payment-e2e";
export const E2E_PAYMENT_SCHEDULE_ID = "ps-manual-payment-e2e";
export const E2E_MANUAL_PROPOSAL_ID = "prop-manual-payment-e2e";

export type ManualPaymentScheduleState =
  | "FAILED"
  | "FAILED_PERMANENT"
  | "SCHEDULED"
  | "PAID";

export type ManualPaymentMockOptions = {
  scheduleState?: ManualPaymentScheduleState;
  manualChargeOutcome?: "FAILED" | "FAILED_PERMANENT" | "PAID" | "IN_ANALYSIS";
};

function getServiceRpcPayload() {
  return {
    id: E2E_MANUAL_SR_ID,
    list_phase: "in_progress",
    request: {
      title: E2E_MANUAL_SR_TITLE,
      description: "Serviço contratado com falha de pagamento para retry manual.",
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
      proposal_count: 1,
      has_pending_proposal: false,
    },
    contracted: {
      id: E2E_CONTRACTED_SERVICE_ID,
      status: "SCHEDULED",
      scheduled_start_date: "2026-06-20",
      scheduled_end_date: null,
      scheduled_shift: "morning",
      duration_unit: "hours",
      duration_value: 2,
      chat_id: E2E_CHAT_ID,
      provider: {
        id: E2E_PROVIDER_ID,
        display_name: "Prestador E2E",
      },
    },
    counterparty: {
      id: E2E_PROVIDER_ID,
      display_name: "Prestador E2E",
    },
  };
}

function paymentScheduleRow(state: ManualPaymentScheduleState) {
  return {
    id: E2E_PAYMENT_SCHEDULE_ID,
    contracted_service_id: E2E_CONTRACTED_SERVICE_ID,
    state,
    client_card_token_id: E2E_PAYMENT_TOKEN_ID,
    installment_number: 1,
    base_amount: 450,
    failure_reason: "Cartão recusado",
    failure_code: "CARD_DECLINED",
  };
}

function paymentTokenRow() {
  return {
    id: E2E_PAYMENT_TOKEN_ID,
    card_number_masked: "497010XXXXXX0048",
    card_brand: "VISA",
    expiry_month: 12,
    expiry_year: 2030,
    state: "ACTIVE",
  };
}

export async function installPaymentsManualMocks(
  page: Page,
  options: ManualPaymentMockOptions = {},
) {
  const scheduleState = options.scheduleState ?? "FAILED";
  const manualChargeOutcome = options.manualChargeOutcome ?? "FAILED_PERMANENT";

  const captured = {
    manualChargeRequests: [] as unknown[],
    updateMethodRequests: [] as unknown[],
  };

  await page.route(/\/rest\/v1\/payment_schedules/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const contractedFilter = url.searchParams.get("contracted_service_id");

    if (contractedFilter === `eq.${E2E_CONTRACTED_SERVICE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(paymentScheduleRow(scheduleState)),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route(/\/rest\/v1\/contracted_services/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const idFilter = url.searchParams.get("id");

    if (idFilter === `eq.${E2E_CONTRACTED_SERVICE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted_proposal_id: E2E_MANUAL_PROPOSAL_ID,
          service_request_id: E2E_MANUAL_SR_ID,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route(/\/rest\/v1\/client_card_tokens(_safe_v)?/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const idFilter = url.searchParams.get("id");

    if (idFilter === `eq.${E2E_PAYMENT_TOKEN_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(paymentTokenRow()),
      });
      return;
    }

    // Saved-card list for ManualPaymentDialog card step
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([paymentTokenRow()]),
    });
  });

  await page.route("**/functions/v1/manual-charge-payment", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    captured.manualChargeRequests.push(route.request().postDataJSON());

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schedule_id: E2E_PAYMENT_SCHEDULE_ID,
        outcome: manualChargeOutcome,
        charge_amount: "450.00",
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

      case "payment_calculate_installment_options":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            installment_options: [
              {
                installment_number: 1,
                applicable_rate_pct: 0,
                installment_amount: 450,
                total_with_fees: 450,
              },
              {
                installment_number: 2,
                applicable_rate_pct: 2.5,
                installment_amount: 230.63,
                total_with_fees: 461.25,
              },
            ],
            installment_selection_hmac: "installment-hmac-manual-e2e",
            installment_hmac_payload: {
              proposal_id: E2E_MANUAL_PROPOSAL_ID,
              service_id: E2E_MANUAL_SR_ID,
              base_amount: 450,
              card_brand: "VISA",
              installment_options: [
                {
                  installment_number: 1,
                  applicable_rate_pct: 0,
                  installment_amount: 450,
                  total_with_fees: 450,
                },
                {
                  installment_number: 2,
                  applicable_rate_pct: 2.5,
                  installment_amount: 230.63,
                  total_with_fees: 461.25,
                },
              ],
              computed_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            },
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            computed_at: new Date().toISOString(),
          }),
        });
        return;

      case "payment_update_method":
        captured.updateMethodRequests.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schedule_id: E2E_PAYMENT_SCHEDULE_ID,
            client_card_token_id: E2E_PAYMENT_TOKEN_ID,
            installment_number: 1,
          }),
        });
        return;

      default:
        await route.fallback();
    }
  });

  return { captured, scheduleState, manualChargeOutcome };
}
