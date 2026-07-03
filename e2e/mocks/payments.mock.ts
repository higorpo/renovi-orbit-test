/**
 * Payment checkout REST/Edge mocks for Playwright (Task 95).
 */
import type { Page } from "@playwright/test";

export const E2E_PAYMENT_TOKEN_ID = "token-e2e-1";

export async function installPaymentsCheckoutMocks(page: Page) {
  const captured = {
    tokenizeRequests: [] as unknown[],
    cpfUpserts: [] as unknown[],
  };

  await page.route("**/functions/v1/tokenize-payment-card", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    captured.tokenizeRequests.push(route.request().postDataJSON());

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        payment_token_id: E2E_PAYMENT_TOKEN_ID,
        card_number_masked: "497010XXXXXX0048",
        card_brand: "VISA",
      }),
    });
  });

  await page.route(/\/rest\/v1\/client_profiles_private/, async (route) => {
    if (route.request().method() === "POST" || route.request().method() === "PATCH") {
      captured.cpfUpserts.push(route.request().postDataJSON());
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route(/\/rest\/v1\/client_card_tokens/, async (route) => {
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

  return { captured };
}
