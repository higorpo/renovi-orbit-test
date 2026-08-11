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

function chargeCreateResponse(
  transactionState: string,
  rejectedReason?: string | null,
): Response {
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
                  ...(rejectedReason != null ? { rejectedReason } : {}),
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
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => chargeCreateResponse("REJECTED"),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "REJECTED");
});

Deno.test("createCharge maps risk-analysis rejectedReason to stable failure code", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      chargeCreateResponse(
        "REJECTED",
        "Análise de Risco: Pedido Suspenso por suspeita de fraude baseado no contato com o “cliente” ou ainda na base ClearSale.",
      ),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "RISK_ANALYSIS_FRAUD_SUSPICION");
  assertEquals(
    result.error?.message.includes("Análise de Risco"),
    true,
  );
});

Deno.test("createCharge maps network timeout to RETRYABLE error", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
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
    email: "cliente@prestway.com",
  };
}

Deno.test("refundTransaction maps ALREADY_REFUNDED to idempotent success", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
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

  assertEquals(requestBody?.variables?.input?.customerInput?.email, "cliente@prestway.com");
});

Deno.test("tokenizeCard surfaces rejectedReason when profile is inactive", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  const adapter = AdapterRegistry.get("netcred");
  assertEquals(adapter instanceof NetCredAdapter, true);
});

Deno.test("AdapterRegistry.get throws for unknown gateway slug", () => {
  configureAdapterRegistry({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
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
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
      fetchFn: async () => chargeCreateResponse("PAID"),
    });

    await adapter.createCharge(sampleChargeInput());
    assertEquals(spanOperations.includes("chargeCreate"), true);
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});

Deno.test("createCharge returns RETRYABLE when chargeCreate has no transaction state", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            chargeCreate: {
              errors: [],
              charge: {
                id: "417417",
                referenceCode: "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e",
                transactions: { edges: [{ node: { id: "tx-1", amount: "1000.00" } }] },
              },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
  assertEquals(result.error?.message, "chargeCreate returned no transaction state");
});

Deno.test("createCharge maps terminal gateway errors to TERMINAL", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            chargeCreate: {
              errors: [{ code: "CPF_INVALID", message: "invalid cpf" }],
              charge: null,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "CPF_INVALID");
  assertEquals(result.error?.message, "invalid cpf");
});

Deno.test("createCharge maps REJECTED gateway error code to REJECTED transactionState", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            chargeCreate: {
              errors: [{ code: "REJECTED", message: "antifraud" }],
              charge: null,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "REJECTED");
});

Deno.test("createCharge maps INTERNAL_SERVER_ERROR and unknown gateway errors to RETRYABLE", async () => {
  const adapterInternal = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            chargeCreate: {
              errors: [{ code: "INTERNAL_SERVER_ERROR", message: "upstream" }],
              charge: null,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const internal = await adapterInternal.createCharge(sampleChargeInput());
  assertEquals(internal.success, false);
  assertEquals(internal.error?.code, "RETRYABLE");
  assertEquals(internal.error?.message, "upstream");

  const adapterUnknown = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            chargeCreate: {
              errors: [{ code: "RATE_LIMITED", message: "slow down" }],
              charge: null,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const unknown = await adapterUnknown.createCharge(sampleChargeInput());
  assertEquals(unknown.success, false);
  assertEquals(unknown.error?.code, "RETRYABLE");
  assertEquals(unknown.error?.message, "slow down");
});

Deno.test("createCharge maps TypeError network failure to RETRYABLE", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      throw new TypeError("fetch failed");
    },
  });

  const result = await adapter.createCharge(sampleChargeInput());

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
  assertEquals(result.error?.message, "fetch failed");
});

Deno.test("createCharge rethrows non-network errors", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      throw new Error("unexpected adapter failure");
    },
  });

  await assertRejects(
    () => adapter.createCharge(sampleChargeInput()),
    Error,
    "unexpected adapter failure",
  );
});

Deno.test("referenceCode conflict reconciles existing REJECTED as TERMINAL", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let callCount = 0;

  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            data: {
              chargeCreate: {
                errors: [{
                  code: "REFERENCE_CODE_CONFLICT",
                  message: "referenceCode conflict",
                  field: "referenceCode",
                }],
                charge: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return transactionsResponse("REJECTED", referenceCode);
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "REJECTED");
  assertEquals(result.transactionId, "tx-existing");
});

Deno.test("referenceCode conflict with unreconcilable state is TERMINAL", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let callCount = 0;

  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            data: {
              chargeCreate: {
                errors: [{
                  message: "duplicate reference code",
                }],
                charge: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return transactionsResponse("PROCESSING", referenceCode);
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "PROCESSING");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "PROCESSING");
});

Deno.test("referenceCode conflict reconciles existing IN_ANALYSIS as success", async () => {
  const referenceCode = "c4a81f63-2d9e-4b1c-8e7a-1f0d9c8b7a6e";
  let callCount = 0;

  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            data: {
              chargeCreate: {
                errors: [{
                  code: "DUPLICATE_REFERENCE_CODE",
                  message: "already exists",
                }],
                charge: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return transactionsResponse("IN_ANALYSIS", referenceCode);
    },
  });

  const result = await adapter.createCharge(sampleChargeInput(referenceCode));

  assertEquals(result.success, true);
  assertEquals(result.transactionState, "IN_ANALYSIS");
  assertEquals(result.transactionId, "tx-existing");
});

Deno.test("reconcileFromExisting returns REFERENCE_CODE_CONFLICT when existing is null", () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  const result = adapter.reconcileFromExisting(null, "ref");

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "REFERENCE_CODE_CONFLICT");
  assertEquals(result.error?.originalCode, "REFERENCE_CODE_CONFLICT_UNRESOLVABLE");
});

Deno.test("processWebhookEvent always delegates to edge function", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
  });

  const result = await adapter.processWebhookEvent({
    gatewaySlug: "netcred",
    eventType: "charge.paid",
    providerEventId: "evt-1",
    rawPayload: {},
    rawHeaders: {},
    webhookEventId: "wh-1",
  });

  assertEquals(result.handled, false);
  assertEquals(result.skippedReason, "WEBHOOK_PROCESSING_DELEGATED_TO_EDGE_FUNCTION");
});

Deno.test("refundTransaction success and invalid transactionId", async () => {
  const successAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            transactionRefund: {
              errors: [],
              transaction: { id: "444677", transactionState: "REFUNDED" },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const ok = await successAdapter.refundTransaction({
    transactionId: "444677",
    amount: "10.00",
  });
  assertEquals(ok.success, true);

  const invalidAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => new Response("{}", { status: 200 }),
  });

  const invalid = await invalidAdapter.refundTransaction({ transactionId: "abc" });
  assertEquals(invalid.success, false);
  assertEquals(invalid.error?.code, "UNKNOWN");
  assertEquals(invalid.error?.message, "Invalid transactionId");
});

Deno.test("refundTransaction maps gateway error codes", async () => {
  async function refundWithError(code: string, message: string) {
    const adapter = new NetCredAdapter({
      supabase: createSupabaseStub(),
      platformBankAccountId: "2052",
    platformCompanyId: "1014",
      graphqlUrl: TEST_GRAPHQL_URL,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            data: {
              transactionRefund: {
                errors: [{ code, message }],
                transaction: null,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });
    return adapter.refundTransaction({ transactionId: "444677" });
  }

  const notFound = await refundWithError("TRANSACTION_DOES_NOT_EXIST", "missing");
  assertEquals(notFound.success, false);
  assertEquals(notFound.error?.code, "TRANSACTION_NOT_FOUND");

  const invalidAmount = await refundWithError(
    "TRANSACTION_INVALID_REFUND_AMOUNT",
    "amount too high",
  );
  assertEquals(invalidAmount.success, false);
  assertEquals(invalidAmount.error?.code, "INVALID_REFUND_AMOUNT");

  const alreadyZero = await refundWithError(
    "TRANSACTION_INVALID_REFUND_AMOUNT",
    "Refundable amount (0.00)",
  );
  assertEquals(alreadyZero.success, true);
  assertEquals(alreadyZero.error?.code, "ALREADY_REFUNDED");

  const unknown = await refundWithError("WEIRD", "no idea");
  assertEquals(unknown.success, false);
  assertEquals(unknown.error?.code, "UNKNOWN");
});

Deno.test("refundTransaction maps network error to UNKNOWN", async () => {
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      throw new TypeError("offline");
    },
  });

  const result = await adapter.refundTransaction({ transactionId: "444677" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "UNKNOWN");
  assertEquals(result.error?.message, "offline");
});

Deno.test("tokenizeCard maps gateway errors and inactive profile without reason", async () => {
  const gatewayErrorAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            paymentProfileCreate: {
              errors: [{ code: "CARD_INVALID", message: "bad card" }],
              paymentProfile: null,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const gatewayError = await gatewayErrorAdapter.tokenizeCard(sampleTokenizeInput());
  assertEquals(gatewayError.isActive, false);
  assertEquals(gatewayError.errors?.[0]?.code, "CARD_INVALID");
  assertEquals(gatewayError.errors?.[0]?.message, "bad card");

  const inactiveAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          data: {
            paymentProfileCreate: {
              errors: [],
              paymentProfile: { id: "1", isActive: false },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const inactive = await inactiveAdapter.tokenizeCard(sampleTokenizeInput());
  assertEquals(inactive.isActive, false);
  assertEquals(inactive.errors?.[0]?.code, "PAYMENT_PROFILE_INACTIVE");
  assertEquals(inactive.errors?.[0]?.message, "Tokenization failed");
});

Deno.test("tokenizeCard maps network error and throws for invalid companyId", async () => {
  const networkAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      throw new TypeError("tokenize offline");
    },
  });

  const network = await networkAdapter.tokenizeCard(sampleTokenizeInput());
  assertEquals(network.isActive, false);
  assertEquals(network.errors?.[0]?.message, "tokenize offline");

  const invalidCompanyAdapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => new Response("{}", { status: 200 }),
  });

  await assertRejects(
    () =>
      invalidCompanyAdapter.tokenizeCard({
        ...sampleTokenizeInput(),
        customerInput: { companyId: "bad", persist: false },
      }),
    Error,
    "TOKENIZE_COMPANY_ID_REQUIRED",
  );
});

Deno.test("createCharge accepts graphqlUrl override without /graphql suffix", async () => {
  let requestedUrl = "";
  const adapter = new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: "https://api.netcredbrasil.com.br/",
    fetchFn: async (url) => {
      requestedUrl = String(url);
      return chargeCreateResponse("PAID");
    },
  });

  await adapter.createCharge(sampleChargeInput());
  assertEquals(requestedUrl, "https://api.netcredbrasil.com.br/graphql");
});
