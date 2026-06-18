/**
 * Dispatch lifecycle E2E (task 76).
 * Default: mocked Supabase edge + RPC. Set E2E_MATCHING_REAL_SUPABASE=1 for staging.
 */
import { test, expect } from "../fixtures/auth.fixture";
import {
  E2E_DISPATCH_LIFECYCLE_CHAT_ID,
  E2E_DISPATCH_LIFECYCLE_JOB_TITLE,
  E2E_DISPATCH_LIFECYCLE_PROVIDER_ID,
  E2E_DISPATCH_LIFECYCLE_SR_ID,
  installDispatchLifecycleMocks,
} from "../mocks/dispatch-lifecycle.mock";
import { ProviderJobsPage } from "../pages/provider-jobs.page";
import { chatPath, ServiceDetailPage } from "../pages/service-detail.page";

const useRealSupabase = process.env.E2E_MATCHING_REAL_SUPABASE === "1";

async function setupProviderSession(
  seedSession: (overrides?: { id?: string; role?: string }) => Promise<void>,
  mockSupabaseAsUser: (
    user?: { id?: string; role?: string },
    profile?: { id?: string; role?: "client" | "provider" },
  ) => ReturnType<typeof import("../mocks/supabase.mock").installSupabaseMocks>,
  page: import("@playwright/test").Page,
  mockOptions: Parameters<typeof installDispatchLifecycleMocks>[1] = {},
) {
  if (useRealSupabase) return null;

  await seedSession({ id: E2E_DISPATCH_LIFECYCLE_PROVIDER_ID, role: "provider" });
  await mockSupabaseAsUser(
    { id: E2E_DISPATCH_LIFECYCLE_PROVIDER_ID, role: "provider" },
    { id: E2E_DISPATCH_LIFECYCLE_PROVIDER_ID, role: "provider" },
  );
  return installDispatchLifecycleMocks(page, mockOptions);
}

test.describe("Matching — dispatch lifecycle feed gates", () => {
  test.skip(
    useRealSupabase,
    "Set E2E_MATCHING_REAL_SUPABASE only when staging fixtures are configured.",
  );

  test("shows lazy fallback opportunity after pool exhaustion", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const lifecycle = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      initialFeedMode: "empty",
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectEmptyFeed();

    lifecycle?.openFallbackMarket();
    await page.reload();

    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Mercado aberto")).toBeVisible();
  });

  test("keeps batch visibility after DISPATCH_EXPIRED", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const lifecycle = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      initialFeedMode: "batch",
      batchVisibilityBeforeExpiry: true,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Mercado aberto")).toHaveCount(0);

    lifecycle?.expireDispatch();
    await page.reload();

    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Mercado aberto")).toHaveCount(0);
  });

  test("hides lazy fallback after DISPATCH_EXPIRED without batch visibility", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const lifecycle = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      initialFeedMode: "fallback",
      batchVisibilityBeforeExpiry: false,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toBeVisible({
      timeout: 15_000,
    });

    lifecycle?.expireDispatch();
    await page.reload();

    await jobs.expectEmptyFeed();
  });

  test("DISPATCH_PAUSED prevents opening a second batch", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const lifecycle = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      initialFeedMode: "batch",
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    expect(lifecycle?.getBatchCount()).toBe(1);

    lifecycle?.pauseDispatch();
    const cronResult = lifecycle?.simulateCronSecondBatch();
    expect(cronResult?.batchOpened).toBe(false);
    expect(cronResult?.batchCount).toBe(1);

    await page.reload();
    await expect(jobs.jobCard(E2E_DISPATCH_LIFECYCLE_JOB_TITLE)).toHaveCount(1);
  });
});

test.describe("Matching — DISPATCH_STOPPED service gates", () => {
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
    const detail = new ServiceDetailPage(page, E2E_DISPATCH_LIFECYCLE_JOB_TITLE);

    await detail.goto(E2E_DISPATCH_LIFECYCLE_SR_ID);
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
    const detail = new ServiceDetailPage(page, E2E_DISPATCH_LIFECYCLE_JOB_TITLE);

    await detail.goto(E2E_DISPATCH_LIFECYCLE_SR_ID);
    await expect(detail.titleHeading).toBeVisible({ timeout: 15_000 });

    await detail.initiateNegotiation();

    await expect(page).toHaveURL(new RegExp(`${chatPath(E2E_DISPATCH_LIFECYCLE_CHAT_ID)}$`), {
      timeout: 15_000,
    });
    expect(mocks?.capturedRpc.initiateConversation.length).toBeGreaterThan(0);
    expect(mocks?.capturedRpc.initiateConversation[0]).toEqual(
      expect.objectContaining({
        p_service_request_id: E2E_DISPATCH_LIFECYCLE_SR_ID,
      }),
    );
  });
});
