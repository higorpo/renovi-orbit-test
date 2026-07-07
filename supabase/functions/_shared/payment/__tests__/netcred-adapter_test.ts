import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { CRITICAL_ALERTS } from "../../observability/critical-alerts.ts";
import { setGatewaySpanRecorderForTests } from "../../observability/gateway-spans.ts";
import { BillingAddressRequiredError, SandboxCredentialsError } from "../errors.ts";
import { NetCredAdapter } from "../netcred-adapter.ts";
import { AdapterRegistry, configureAdapterRegistry } from "../registry.ts";
import type { CreateChargeInput, TokenizeCardInput } from "../types.ts";

const TEST_GRAPHQL_URL = "https://api.netcredbrasil.com.br/graphql";

function createSupabaseStub(): SupabaseClient<Database> {
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

function chargeCreateResponse(transactionState: string): Response {
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
                  id: "tx-1",
                  transactionState,
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

function transactionsResponse(
  transactionState: string,
  referenceCode: string,
): Response {
  return new Response(
    JSON.stringify({
      data: {
        transactions: {
          edges: [{
            node: {
              id: "tx-existing",
              transactionState,
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
}

Deno.test("createCharge parses PAID response correctly", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => chargeCreateResponse("PAID"),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, true);
  assertEquals(result.transactionState, "PAID");
  assertEquals(result.chargeId, "417417");
  assertEquals(result.transactionId, "tx-1");
});

Deno.test("createCharge maps REJECTED to TERMINAL error", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => chargeCreateResponse("REJECTED"),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "REJECTED");
});

Deno.test("createCharge maps network timeout to RETRYABLE error", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    },
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
});

Deno.test("referenceCode conflict reconciles via getTransaction", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let callCount = 0;

  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      callCount += 1;
      if (callCount === 1) {
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

      return transactionsResponse("PAID", referenceCode);
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(callCount, 2);
  assertEquals(result.success, true);
  assertEquals(result.transactionState, "PAID");
  assertEquals(result.transactionId, "tx-existing");
});

function sampleTokenizeInput(): TokenizeCardInput {
  return {
    cardData: {
      cardNumber: "4970100000000048",
      cvv: "123",
      expiryMonth: 10,
      expiryYear: 2027,
      cardholderName: "Maria da Silva",
    },
    billingAddress: {
      street: "Rua Exemplo",
      number: "100",
      district: "Centro",
      city: "Joinville",
      state: "SC",
      zipCode: "89201420",
    },
    customerInput: {
      companyId: "1048",
      persist: false,
    },
    cpf: "03019758092",
    phone: "48999999999",
    email: "cliente@renovi.com.br",
  };
}

Deno.test("refundTransaction maps ALREADY_REFUNDED to idempotent success", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => new Response(
      JSON.stringify({
        data: {
          transactionRefund: {
            errors: [{
              code: "ALREADY_REFUNDED",
              message: "Transaction already refunded",
              field: null,
            }],
            transaction: null,
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  });

  const result = await adapter.refundTransaction({ transactionId: "444677" });

  assertEquals(result.success, true);
  assertEquals(result.error?.code, "ALREADY_REFUNDED");
});

Deno.test("tokenizeCard includes email in customerInput", async () => {
  let requestBody: { variables?: { input?: { customerInput?: { email?: string } } } } | undefined;

  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          data: {
            paymentProfileCreate: {
              errors: [],
              paymentProfile: {
                id: "403137",
                isActive: true,
                cardNumber: "497010XXXXXX0048",
                brand: "VCC",
                token: "gateway-token",
              },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await adapter.tokenizeCard(sampleTokenizeInput());

  assertEquals(requestBody?.variables?.input?.customerInput?.email, "cliente@renovi.com.br");
});

Deno.test("tokenizeCard surfaces rejectedReason when profile is inactive", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => new Response(
      JSON.stringify({
        data: {
          paymentProfileCreate: {
            errors: [],
            paymentProfile: {
              id: "403138",
              isActive: false,
              rejectedReason: "Antifraud rejected the transaction",
            },
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  });

  const result = await adapter.tokenizeCard(sampleTokenizeInput());

  assertEquals(result.isActive, false);
  assertEquals(result.errors?.[0]?.message, "Antifraud rejected the transaction");
  assertEquals(result.errors?.[0]?.code, "PAYMENT_PROFILE_REJECTED");
});

Deno.test("tokenizeCard throws BILLING_ADDRESS_REQUIRED before gateway call in production", async () => {
  let fetchCalled = false;
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    isProduction: true,
    fetchFn: async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    },
  });

  const input = {
    ...sampleTokenizeInput(),
    billingAddress: {
      street: "",
      number: "",
      district: "",
      city: "",
      state: "",
      zipCode: "",
    },
  };

  await assertRejects(
    () => adapter.tokenizeCard(input),
    BillingAddressRequiredError,
    "BILLING_ADDRESS_REQUIRED",
  );
  assertEquals(fetchCalled, false);
});

Deno.test("AdapterRegistry.get returns configured netcred adapter", () => {
  configureAdapterRegistry({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  const adapter = AdapterRegistry.get("netcred");
  assertEquals(adapter instanceof NetCredAdapter, true);
});

Deno.test("AdapterRegistry.get throws for unknown gateway slug", () => {
  configureAdapterRegistry({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  let thrown = false;
  try {
    AdapterRegistry.get("unknown-gateway");
  } catch (error) {
    thrown = true;
    assertEquals(
      error instanceof Error && error.message.includes("PAYMENT_ADAPTER_NOT_REGISTERED"),
      true,
    );
  }
  assertEquals(thrown, true);
});

Deno.test("NetCredAdapter.createCharge aborts sandbox credentials in production", async () => {
  const criticalMessages: string[] = [];
  const supabase = {
    rpc(name: string, args?: { p_new_token?: string; p_expires_at?: string }) {
      if (name === "acquire_or_refresh_netcred_token") {
        if (args?.p_new_token) {
          return Promise.resolve({
            data: { status: "refreshed", token: args.p_new_token },
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
      return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
    },
  } as unknown as SupabaseClient<Database>;

  configureAdapterRegistry({
    supabase,
    platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    isProduction: true,
    captureCritical: (message) => {
      criticalMessages.push(message);
    },
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            tokenAuth: {
              token: "sandbox-jwt",
              errors: [],
              user: { sandbox: true },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  await assertRejects(
    () => AdapterRegistry.get("netcred").createCharge(sampleChargeInput()),
    SandboxCredentialsError,
  );

  assertEquals(
    criticalMessages.includes(CRITICAL_ALERTS.SANDBOX_CREDENTIALS_IN_PRODUCTION),
    true,
  );
});

Deno.test("NetCredAdapter.createCharge emits gateway span for chargeCreate", async () => {
  const spanOperations: string[] = [];
  setGatewaySpanRecorderForTests((record) => {
    spanOperations.push(record.operation);
  });

  try {
    const adapter = new NetCredAdapter({
      supabase: createSupabaseStub(),
      platformBankAccountId: "2052",
    graphqlUrl: TEST_GRAPHQL_URL,
      fetchFn: async () => chargeCreateResponse("PAID"),
    });

    await adapter.createCharge(sampleChargeInput());
    assertEquals(spanOperations.includes("chargeCreate"), true);
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});
