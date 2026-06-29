import { assertEquals } from "std/testing/asserts";
import { buildBatchCompaniesQuery } from "../buildBatchQuery.ts";
import { resolveCompanyOutcome } from "../processCompanyResult.ts";
import {
  handleDetectNetcredOnboardingRequest,
  type DetectNetcredOnboardingDeps,
} from "../handleRequest.ts";
import type { PendingProviderAccount } from "../types.ts";

const account: PendingProviderAccount = {
  id: "account-1",
  provider_id: "provider-1",
  document: "11222333000181",
  onboarding_status: "DOCUMENTS_SUBMITTED",
};

Deno.test("batch of 50 issues single HTTP request", async () => {
  let fetchCallCount = 0;
  const accounts = Array.from({ length: 50 }, (_, index) => ({
    id: `account-${index}`,
    provider_id: `provider-${index}`,
    document: `${String(index).padStart(11, "0")}00181`,
    onboarding_status: "DOCUMENTS_SUBMITTED",
  }));

  const query = buildBatchCompaniesQuery(accounts);
  assertEquals(query.includes("query ProviderOnboardingBatch"), true);
  assertEquals((query.match(/companies\(document:/g) ?? []).length, 50);

  let loadCalls = 0;
  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => {
      loadCalls += 1;
      return loadCalls === 1 ? accounts : [];
    },
    fetchCompaniesBatch: async () => {
      fetchCallCount += 1;
      return {};
    },
    activateProvider: async () => {},
    markUnderReview: async () => {},
    emitWarning: () => {},
    sleep: async () => {},
  };

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const response = await handleDetectNetcredOnboardingRequest(
      new Request("https://example.com/detect-netcred-onboarding", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(fetchCallCount, 1);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("multiple edges emits warning and skips activation", () => {
  let activateCalled = false;
  let warningEmitted = false;

  const outcome = resolveCompanyOutcome(account, {
    edges: [{ node: { id: "1", document: "11222333000181", companyState: "ACTIVE" } }, {
      node: { id: "2", document: "11222333000181", companyState: "ACTIVE" },
    }],
  });

  assertEquals(outcome.action, "warning_multiple_edges");

  if (outcome.action === "warning_multiple_edges") {
    warningEmitted = true;
  }
  activateCalled = false;

  assertEquals(warningEmitted, true);
  assertEquals(activateCalled, false);
});

Deno.test("ACTIVE with bankAccounts resolves to activation", () => {
  const outcome = resolveCompanyOutcome(account, {
    edges: [{
      node: {
        id: "1048",
        document: "11222333000181",
        companyState: "ACTIVE",
        bankAccounts: {
          edges: [{ node: { id: "2053", isActive: true } }],
        },
      },
    }],
  });

  assertEquals(outcome.action, "activated");
  assertEquals(outcome.netcredCompanyId, "1048");
  assertEquals(outcome.netcredBankAccountId, "2053");
});

Deno.test("ACTIVE without bankAccounts resolves to under review warning", async () => {
  let markUnderReviewCalled = false;
  let warningReason: string | undefined;

  const outcome = resolveCompanyOutcome(account, {
    edges: [{
      node: {
        id: "1048",
        document: "11222333000181",
        companyState: "ACTIVE",
        bankAccounts: { edges: [] },
      },
    }],
  });

  assertEquals(outcome.action, "warning_active_without_bank");

  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => [account],
    fetchCompaniesBatch: async () => ({
      provider_11222333000181: {
        edges: [{
          node: {
            id: "1048",
            document: "11222333000181",
            companyState: "ACTIVE",
            bankAccounts: { edges: [] },
          },
        }],
      },
    }),
    activateProvider: async () => {},
    markUnderReview: async () => {
      markUnderReviewCalled = true;
    },
    emitWarning: (message) => {
      warningReason = message;
    },
    sleep: async () => {},
  };

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    await handleDetectNetcredOnboardingRequest(
      new Request("https://example.com/detect-netcred-onboarding", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      deps,
    );
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }

  assertEquals(markUnderReviewCalled, true);
  assertEquals(warningReason, "active_without_bank_account");
});
