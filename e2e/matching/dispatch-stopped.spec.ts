/**
 * DISPATCH_STOPPED E2E (task 57).
 * Default: mocked Supabase RPCs. Set E2E_MATCHING_REAL_SUPABASE=1 for staging.
 */
import { test, expect } from "../fixtures/auth.fixture";
import {
  E2E_DISPATCH_STOPPED_PROVIDER_ID,
  E2E_DISPATCH_STOPPED_SR_ID,
  installDispatchStoppedMocks,
} from "../mocks/dispatch-stopped.mock";
import { chatPath, ServiceDetailPage } from "../pages/service-detail.page";

const useRealSupabase = process.env.E2E_MATCHING_REAL_SUPABASE === "1";

async function setupProviderSession(
  seedSession: (overrides?: { id?: string; role?: string }) => Promise<void>,
  mockSupabaseAsUser: (
    user?: { id?: string; role?: string },
    profile?: { id?: string; role?: "client" | "provider" },
  ) => ReturnType<typeof import("../mocks/supabase.mock").installSupabaseMocks>,
  page: import("@playwright/test").Page,
) {
  if (useRealSupabase) return null;

  await seedSession({ id: E2E_DISPATCH_STOPPED_PROVIDER_ID, role: "provider" });
  await mockSupabaseAsUser(
    { id: E2E_DISPATCH_STOPPED_PROVIDER_ID, role: "provider" },
    { id: E2E_DISPATCH_STOPPED_PROVIDER_ID, role: "provider" },
  );
  return installDispatchStoppedMocks(page);
}

test.describe("Matching — DISPATCH_STOPPED gates", () => {
  test.skip(
    useRealSupabase,
    "Set E2E_MATCHING_REAL_SUPABASE only when staging fixtures are configured.",
  );

  test("blocks create_provider_proposal when dispatch is stopped", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const mocks = await setupProviderSession(seedSession, mockSupabaseAsUser, page);
    const detail = new ServiceDetailPage(page);

    await detail.goto();
    await expect(detail.titleHeading).toBeVisible({ timeout: 15_000 });

    await detail.openProposalComposer();
    await detail.submitProposalWithEdit();

    await expect(page.getByText(/DISPATCH_STOPPED|Não foi possível enviar a proposta/i)).toBeVisible({
      timeout: 10_000,
    });
    expect(mocks?.capturedRpc.createProviderProposal.length).toBeGreaterThan(0);
    expect(mocks?.capturedRpc.initiateConversation.length).toBe(0);
  });

  test("allows cns_initiate_conversation when dispatch is stopped", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const mocks = await setupProviderSession(seedSession, mockSupabaseAsUser, page);
    const detail = new ServiceDetailPage(page);

    await detail.goto();
    await expect(detail.titleHeading).toBeVisible({ timeout: 15_000 });

    await detail.initiateNegotiation();

    await expect(page).toHaveURL(new RegExp(`${chatPath()}$`), { timeout: 15_000 });
    expect(mocks?.capturedRpc.initiateConversation.length).toBeGreaterThan(0);
    expect(mocks?.capturedRpc.initiateConversation[0]).toEqual(
      expect.objectContaining({
        p_service_request_id: E2E_DISPATCH_STOPPED_SR_ID,
      }),
    );
  });
});
