/**
 * Payment checkout happy path E2E (Task 95).
 * Mocked Supabase RPCs, REST, and tokenize edge function (sandbox-style responses).
 */
import { test, expect } from "../fixtures/auth.fixture";
import {
  E2E_CHAT_ID,
  E2E_CLIENT_ID,
  installChatsMocks,
} from "../mocks/chats.mock";
import { installPaymentsCheckoutMocks } from "../mocks/payments.mock";
import { PaymentsCheckoutPage } from "../pages/payments-checkout.page";

const useRealSupabase = process.env.E2E_PAYMENTS_REAL_SUPABASE === "1";

test.describe("Payments checkout — happy path", () => {
  test.skip(useRealSupabase, "Set E2E_PAYMENTS_REAL_SUPABASE only when staging NetCred sandbox is configured.");

  test("client completes checkout stepper and accepts proposal with payment", async ({
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

    const chatMocks = await installChatsMocks(page, {
      viewerUserId: E2E_CLIENT_ID,
      viewerRole: "client",
      withPendingProposal: true,
      withPaymentCheckout: true,
    });
    const paymentMocks = await installPaymentsCheckoutMocks(page);

    const checkout = new PaymentsCheckoutPage(page);

    await checkout.startPaymentCheckoutFromProposal();
    await checkout.completeCpfStep();
    await checkout.completeCardStep();
    await checkout.completeInstallmentStep();
    await checkout.confirmCheckout();

    await expect(page.getByText("Proposta aceita com sucesso.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Pagamento" })).toBeHidden();

    expect(chatMocks.capturedRpc.acceptProposal.length).toBeGreaterThan(0);
    expect(paymentMocks.captured.tokenizeRequests.length).toBe(1);
  });
});
