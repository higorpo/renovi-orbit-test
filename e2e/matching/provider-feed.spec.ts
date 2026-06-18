/**
 * Progressive provider feed E2E (tasks 55–56).
 * Default: mocked Supabase edge + RPC. Set E2E_MATCHING_REAL_SUPABASE=1 for staging.
 */
import { test, expect } from "../fixtures/auth.fixture";
import {
  E2E_FEED_PAGE_SIZE,
  E2E_FEED_PAGINATED_TOTAL,
  E2E_FEED_PROVIDER_ID,
  installProviderFeedMocks,
  type ProviderFeedMockOptions,
} from "../mocks/provider-feed.mock";
import { ProviderJobsPage } from "../pages/provider-jobs.page";

const useRealSupabase = process.env.E2E_MATCHING_REAL_SUPABASE === "1";

async function setupProviderSession(
  seedSession: (overrides?: { id?: string; role?: string }) => Promise<void>,
  mockSupabaseAsUser: (
    user?: { id?: string; role?: string },
    profile?: { id?: string; role?: "client" | "provider" },
  ) => ReturnType<typeof import("../mocks/supabase.mock").installSupabaseMocks>,
  page: import("@playwright/test").Page,
  mockOptions: ProviderFeedMockOptions = {},
) {
  if (useRealSupabase) return null;

  await seedSession({ id: E2E_FEED_PROVIDER_ID, role: "provider" });
  await mockSupabaseAsUser(
    { id: E2E_FEED_PROVIDER_ID, role: "provider" },
    { id: E2E_FEED_PROVIDER_ID, role: "provider" },
  );
  return installProviderFeedMocks(page, mockOptions);
}

test.describe("Matching — progressive provider feed", () => {
  test.skip(
    useRealSupabase,
    "Set E2E_MATCHING_REAL_SUPABASE only when staging fixtures are configured.",
  );

  test("shows empty feed before matching batch opens", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      batchOpenInitially: false,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await expect(jobs.heading).toBeVisible({ timeout: 15_000 });
    await jobs.expectEmptyFeed();
  });

  test("shows opportunity after batch open", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const feed = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      batchOpenInitially: false,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectEmptyFeed();

    feed?.openBatch();
    await page.reload();

    await jobs.expectVisibleOpportunity();
    await expect(jobs.page.getByText(/1 oportunidade na lista/i)).toBeVisible();
  });

  test("dismiss hides opportunity from feed", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      batchOpenInitially: true,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectVisibleOpportunity();
    await jobs.dismissCurrentOpportunity();
    await jobs.expectEmptyFeed();
  });

  test("detail link opens service page", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      batchOpenInitially: true,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectVisibleOpportunity();
    await jobs.openServiceDetailViaLink();
  });
});

test.describe("Matching — cursor pagination stability", () => {
  test.skip(
    useRealSupabase,
    "Set E2E_MATCHING_REAL_SUPABASE only when staging fixtures are configured.",
  );

  test("loads page 2 via cursor without duplicate cards", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const feed = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      paginatedFeed: true,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectUniquePaginatedJobs(E2E_FEED_PAGE_SIZE);
    await expect(jobs.loadMoreButton).toBeVisible();

    await jobs.loadMore();
    await jobs.expectUniquePaginatedJobs(E2E_FEED_PAGINATED_TOTAL);
    await expect(jobs.loadMoreButton).toBeHidden();

    const requests = feed?.capturedFeedRequests ?? [];
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests.some((request) => request.cursor === null)).toBe(true);
  });

  test("changing sort resets cursor and refetches page 1", async ({
    page,
    seedSession,
    mockSupabaseAsUser,
  }) => {
    const feed = await setupProviderSession(seedSession, mockSupabaseAsUser, page, {
      paginatedFeed: true,
    });
    const jobs = new ProviderJobsPage(page);

    await jobs.goto();
    await jobs.expectUniquePaginatedJobs(E2E_FEED_PAGE_SIZE);
    await jobs.loadMore();
    await jobs.expectUniquePaginatedJobs(E2E_FEED_PAGINATED_TOTAL);

    await jobs.sortTab("Menos concorridos").click();
    await jobs.expectUniquePaginatedJobs(E2E_FEED_PAGE_SIZE);
    await expect(jobs.loadMoreButton).toBeVisible();

    const leastCompetitiveRequests = (feed?.capturedFeedRequests ?? []).filter(
      (request) => request.sort_mode === "least_competitive",
    );
    expect(leastCompetitiveRequests.length).toBeGreaterThan(0);
    expect(leastCompetitiveRequests[0]?.cursor).toBeNull();
  });
});
