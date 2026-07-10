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

Deno.test("OPTIONS returns 204 and GET returns 405", async () => {
  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => [],
    fetchCompaniesBatch: async () => ({}),
    activateProvider: async () => {},
    markUnderReview: async () => {},
    emitWarning: () => {},
    sleep: async () => {},
  };

  const options = await handleDetectNetcredOnboardingRequest(
    new Request("https://example.com/detect-netcred-onboarding", {
      method: "OPTIONS",
    }),
    deps,
  );
  assertEquals(options.status, 204);

  const get = await handleDetectNetcredOnboardingRequest(
    new Request("https://example.com/detect-netcred-onboarding", {
      method: "GET",
    }),
    deps,
  );
  assertEquals(get.status, 405);
});

Deno.test("activates provider and sleeps between full batches", async () => {
  let activateCalls = 0;
  let sleepCalls = 0;
  let loadCalls = 0;

  const firstBatch = Array.from({ length: 50 }, (_, index) => ({
    id: `account-${index}`,
    provider_id: `provider-${index}`,
    document: "11222333000181",
    onboarding_status: "DOCUMENTS_SUBMITTED",
  }));

  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => {
      loadCalls += 1;
      if (loadCalls === 1) return firstBatch;
      if (loadCalls === 2) {
        return [{
          id: "account-last",
          provider_id: "provider-last",
          document: "11222333000181",
          onboarding_status: "DOCUMENTS_SUBMITTED",
        }];
      }
      return [];
    },
    fetchCompaniesBatch: async () => ({
      provider_11222333000181: {
        edges: [{
          node: {
            id: "c-1",
            document: "11222333000181",
            companyState: "ACTIVE",
            bankAccounts: { edges: [{ node: { id: "b-1", isActive: true } }] },
          },
        }],
      },
    }),
    activateProvider: async () => {
      activateCalls += 1;
    },
    markUnderReview: async () => {},
    emitWarning: () => {},
    sleep: async () => {
      sleepCalls += 1;
    },
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
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.batches, 2);
    assertEquals(sleepCalls, 1);
    assertEquals(activateCalls, 51);
    assertEquals(body.activated, 51);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("multiple edges path increments warnings and skipped", async () => {
  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => [account],
    fetchCompaniesBatch: async () => ({
      provider_11222333000181: {
        edges: [
          { node: { id: "1", document: "11222333000181", companyState: "ACTIVE" } },
          { node: { id: "2", document: "11222333000181", companyState: "ACTIVE" } },
        ],
      },
    }),
    activateProvider: async () => {
      throw new Error("should not activate");
    },
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
    const body = await response.json();
    assertEquals(body.warnings, 1);
    assertEquals(body.skipped, 1);
    assertEquals(body.activated, 0);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("unauthorized cron request returns 401", async () => {
  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => [],
    fetchCompaniesBatch: async () => ({}),
    activateProvider: async () => {},
    markUnderReview: async () => {},
    emitWarning: () => {},
    sleep: async () => {},
  };

  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("ORBIT_CRON_SECRET");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const response = await handleDetectNetcredOnboardingRequest(
      new Request("https://example.com/detect-netcred-onboarding", {
        method: "POST",
      }),
      deps,
    );
    assertEquals(response.status, 401);
    const body = await response.json();
    assertEquals(body.error, "unauthorized");
  } finally {
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("under_review company state marks account under review", async () => {
  let markUnderReviewCalled = false;

  const deps: DetectNetcredOnboardingDeps = {
    loadPendingProviders: async () => [account],
    fetchCompaniesBatch: async () => ({
      provider_11222333000181: {
        edges: [{
          node: {
            id: "1048",
            document: "11222333000181",
            companyState: "PENDING",
            bankAccounts: { edges: [] },
          },
        }],
      },
    }),
    activateProvider: async () => {
      throw new Error("should not activate");
    },
    markUnderReview: async () => {
      markUnderReviewCalled = true;
    },
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
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(markUnderReviewCalled, true);
    assertEquals(body.under_review, 1);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});
