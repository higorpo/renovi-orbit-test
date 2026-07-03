/**
 * Manual payment recovery E2E (Task 96).
 * Button visibility and FAILED_PERMANENT terminal error UX.
 */
import { test, expect } from "../fixtures/auth.fixture";
import { E2E_CLIENT_ID } from "../mocks/chats.mock";
import { installPaymentsManualMocks } from "../mocks/payments-manual.mock";
import { PaymentsManualPage } from "../pages/payments-manual.page";

const useRealSupabase = process.env.E2E_PAYMENTS_REAL_SUPABASE === "1";

test.describe("Payments manual recovery", () => {
  test.skip(useRealSupabase, "Set E2E_PAYMENTS_REAL_SUPABASE only when staging NetCred sandbox is configured.");

  for (const scheduleState of ["SCHEDULED", "PAID"] as const) {
    test(`hides manual payment button when schedule is ${scheduleState}`, async ({
      page,
      seedSession,
      mockSupabaseAsUser,
    }) => {
      await seedSession({ id: E2E_CLIENT_ID, role: "client" });
      await mockSupabaseAsUser(
        { id: E2E_CLIENT_ID, role: "client" },
        { id: E2E_CLIENT_ID, role: "client" },
      );

      await installPaymentsManualMocks(page, { scheduleState });

      const manualPage = new PaymentsManualPage(page);
      await manualPage.goto();

      await expect(manualPage.manualPaymentButton).toBeHidden();
    });
  }

  for (const scheduleState of ["FAILED", "FAILED_PERMANENT"] as const) {
    test(`shows manual payment button when schedule is ${scheduleState}`, async ({
      page,
      seedSession,
      mockSupabaseAsUser,
    }) => {
      await seedSession({ id: E2E_CLIENT_ID, role: "client" });
      await mockSupabaseAsUser(
        { id: E2E_CLIENT_ID, role: "client" },
        { id: E2E_CLIENT_ID, role: "client" },
      );

      await installPaymentsManualMocks(page, { scheduleState });

      const manualPage = new PaymentsManualPage(page);
      await manualPage.goto();

      await expect(manualPage.manualPaymentButton).toBeVisible();
    });
  }

  test("shows terminal error UX after FAILED_PERMANENT manual charge", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    test.setTimeout(60_000);

    await seedSession({ id: E2E_CLIENT_ID, role: "client" });
    await mockSupabaseAsUser(
      { id: E2E_CLIENT_ID, role: "client" },
      { id: E2E_CLIENT_ID, role: "client" },
    );

    const mocks = await installPaymentsManualMocks(page, {
      scheduleState: "FAILED",
      manualChargeOutcome: "FAILED_PERMANENT",
    });

    const manualPage = new PaymentsManualPage(page);
    await manualPage.goto();
    await manualPage.openManualPaymentModal();

    await expect(manualPage.page.getByText(/•••• 0048/i)).toBeVisible({ timeout: 10_000 });

    await manualPage.confirmManualPayment();
    await manualPage.expectTerminalFailureState();

    expect(mocks.captured.manualChargeRequests.length).toBe(1);
  });
});
