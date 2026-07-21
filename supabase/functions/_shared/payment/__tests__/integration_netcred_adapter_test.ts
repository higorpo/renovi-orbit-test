import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { ProviderAuthError } from "../errors.ts";
import { NetCredAdapter } from "../netcred-adapter.ts";
import type { CreateChargeInput } from "../types.ts";

const TEST_GRAPHQL_URL = "https://api.netcredbrasil.com.br/graphql";

type RpcArgs = {
  p_new_token?: string;
  p_expires_at?: string;
  p_is_sandbox?: boolean;
};

function createCachedTokenSupabaseStub(): SupabaseClient<Database> {
  return {
    rpc(name: string) {
      if (name === "acquire_or_refresh_netcred_token") {
        return Promise.resolve({
          data: { status: "cached", token: "jwt-token" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
    },
  } as unknown as SupabaseClient<Database>;
}

function createAuthRefreshSupabaseStub(): SupabaseClient<Database> {
  let acquireIndex = 0;

  return {
    rpc(name: string, args?: RpcArgs) {
      if (name === "acquire_or_refresh_netcred_token") {
        if (args?.p_new_token) {
          return Promise.resolve({
            data: {
              status: "refreshed",
              token: args.p_new_token,
              expires_at: args.p_expires_at,
            },
            error: null,
          });
        }

        acquireIndex += 1;
        if (acquireIndex === 1) {
          return Promise.resolve({
            data: { status: "cached", token: "stale-jwt" },
            error: null,
          });
        }

        return Promise.resolve({
          data: { status: "needs_refresh" },
          error: null,
        });
      }

      if (name === "release_netcred_token_refresh_lock") {
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve({
        data: null,
        error: { message: `unexpected rpc ${name}` },
      });
    },
  } as unknown as SupabaseClient<Database>;
}

function sampleChargeInput(referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e"): CreateChargeInput {
  return {
    referenceCode,
    amount: "1000.00",
    sessionId: "session-uuid",
    customerIpAddress: "189.0.0.1",
    paymentMethod: {
      type: "CREDIT_CARD",
      installmentNumber: 1,
      paymentProfileId: "403137",
      paymentToken: "tok",
    },
    payoutRule: {
      providerAccount: {
        netcredCompanyId: "1048",
        netcredBankAccountId: "2053",
      },
      ruleItems: [
        {
          type: "PERCENTAGE",
          receiver: "provider",
          percentage: 100,
          isLiable: false,
        },
        {
          type: "FIXED_AMOUNT",
          receiver: "platform",
          amount: "100.00",
          isLiable: true,
        },
      ],
    },
  };
}

function chargeCreatePaidResponse(): Response {
  return new Response(
    JSON.stringify({
      data: {
        chargeCreate: {
          errors: [],
          charge: {
            id: "417417",
            referenceCode: "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e",
            transactions: {
              edges: [{
                node: {
                  id: "tx-paid",
                  transactionState: "PAID",
                  amount: "1000.00",
                },
              }],
            },
          },
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function tokenAuthResponse(token: string): Response {
  return new Response(
    JSON.stringify({
      data: {
        tokenAuth: {
          token,
          errors: [],
          user: { sandbox: false },
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

Deno.test("integration: createCharge refreshes auth after JWT_EXPIRED GraphQL error", async () => {
  const authHeaders: string[] = [];
  let fetchCall = 0;

  const adapter = new NetCredAdapter({
    supabase: createAuthRefreshSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    fetchFn: async (_url, init) => {
      fetchCall += 1;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth) authHeaders.push(auth);

      if (body.query?.includes("tokenAuth")) {
        return tokenAuthResponse("fresh-jwt");
      }

      if (fetchCall === 1) {
        return new Response(
          JSON.stringify({
            errors: [{ code: "JWT_EXPIRED", message: "token expired" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return chargeCreatePaidResponse();
    },
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, true);
  assertEquals(result.transactionState, "PAID");
  assertEquals(fetchCall, 3);
  assertEquals(authHeaders[0], "JWT stale-jwt");
  assertEquals(authHeaders[1], "JWT fresh-jwt");
});

Deno.test("integration: createCharge refreshes auth after HTTP 401", async () => {
  let fetchCall = 0;

  const adapter = new NetCredAdapter({
    supabase: createAuthRefreshSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    fetchFn: async (_url, init) => {
      fetchCall += 1;
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (body.query?.includes("tokenAuth")) {
        return tokenAuthResponse("fresh-jwt");
      }

      if (fetchCall === 1) {
        return new Response(
          JSON.stringify({
            errors: [{ code: "UNAUTHENTICATED", message: "Unauthorized" }],
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      return chargeCreatePaidResponse();
    },
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, true);
  assertEquals(fetchCall, 3);
});

Deno.test("integration: createCharge throws ProviderAuthError when auth refresh also fails", async () => {
  let fetchCall = 0;

  const adapter = new NetCredAdapter({
    supabase: createAuthRefreshSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    fetchFn: async (_url, init) => {
      fetchCall += 1;
      const body = init?.body ? JSON.parse(String(init.body)) : {};

      if (body.query?.includes("tokenAuth")) {
        return tokenAuthResponse("fresh-jwt");
      }

      return new Response(
        JSON.stringify({
          errors: [{ code: "UNAUTHENTICATED", message: "invalid token" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await assertRejects(
    () => adapter.createCharge(sampleChargeInput()),
    ProviderAuthError,
    "NETCRED_AUTH_FAILURE",
  );
  assertEquals(fetchCall, 3);
});

Deno.test("integration: referenceCode conflict reconciles existing PAID transaction", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let graphqlCalls = 0;

  const adapter = new NetCredAdapter({
    supabase: createCachedTokenSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      graphqlCalls += 1;
      if (graphqlCalls === 1) {
        return new Response(
          JSON.stringify({
            data: {
              chargeCreate: {
                errors: [{
                  code: "REFERENCE_CODE_ALREADY_EXISTS",
                  message: "referenceCode already exists",
                  field: "referenceCode",
                }],
                charge: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            transactions: {
              edges: [{
                node: {
                  id: "tx-existing",
                  transactionState: "PAID",
                  amount: "1000.00",
                  paidAmount: "1000.00",
                  charge: { id: "417417", referenceCode },
                },
              }],
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(graphqlCalls, 2);
  assertEquals(result.success, true);
  assertEquals(result.transactionState, "PAID");
  assertEquals(result.transactionId, "tx-existing");
});

Deno.test("integration: referenceCode conflict with null getTransaction is terminal", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let graphqlCalls = 0;

  const adapter = new NetCredAdapter({
    supabase: createCachedTokenSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      graphqlCalls += 1;
      if (graphqlCalls === 1) {
        return new Response(
          JSON.stringify({
            data: {
              chargeCreate: {
                errors: [{
                  code: "DUPLICATE_REFERENCE_CODE",
                  message: "duplicate referenceCode",
                  field: "referenceCode",
                }],
                charge: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            transactions: { edges: [] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(graphqlCalls, 2);
  assertEquals(result.success, false);
  assertEquals(result.error?.code, "REFERENCE_CODE_CONFLICT");
  assertEquals(result.error?.originalCode, "REFERENCE_CODE_CONFLICT_UNRESOLVABLE");
});

Deno.test("integration: getTransaction returns null when no transaction matches referenceCode", async () => {
  const adapter = new NetCredAdapter({
    supabase: createCachedTokenSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            transactions: { edges: [] },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await adapter.getTransaction({
    referenceCode: "missing-reference",
    companyId: "1048",
  });

  assertEquals(result, null);
});

Deno.test("integration: refreshAuthToken delegates to token cache RPC path", async () => {
  let acquireCalls = 0;

  const adapter = new NetCredAdapter({
    supabase: {
      rpc(name: string) {
        if (name === "acquire_or_refresh_netcred_token") {
          acquireCalls += 1;
          return Promise.resolve({
            data: { status: "cached", token: "cached-jwt" },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: { message: "unexpected" } });
      },
    } as unknown as SupabaseClient<Database>,
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  await adapter.refreshAuthToken();
  assertEquals(acquireCalls, 1);
});
