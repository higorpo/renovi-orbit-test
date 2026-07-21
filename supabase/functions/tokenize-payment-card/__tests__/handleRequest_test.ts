import { assertEquals } from "std/testing/asserts";
import { handleTokenizePaymentCardRequest } from "../handleRequest.ts";
import type { TokenizePaymentCardDeps } from "../handleRequest.ts";
import type { BillingAddress, TokenizeCardData } from "../../_shared/payment/types.ts";

const billingAddress: BillingAddress = {
  street: "Rua Exemplo",
  number: "100",
  district: "Centro",
  city: "Joinville",
  state: "SC",
  zipCode: "89201420",
};

const cardData: TokenizeCardData = {
  cardNumber: "4970100000000048",
  cvv: "123",
  expiryMonth: 10,
  expiryYear: 2027,
  cardholderName: "Maria da Silva",
};

const customerFields = {
  cpf: "03019758092",
  phone: "48999999999",
};

function createDeps(overrides: Partial<TokenizePaymentCardDeps> = {}): TokenizePaymentCardDeps {
  return {
    getUser: async () => ({
      user: { id: "client-1", email: "cliente@renovi.com.br" },
      error: null,
    }),
    validateCheckoutAccess: async () => {},
    resolvePlatformCompany: async () => ({
      providerUserId: "platform",
      netcredCompanyId: "1014",
    }),
    tokenizeCard: async () => ({
      isActive: true,
      paymentProfileId: "403137",
      cardNumberMasked: "497010XXXXXX0048",
      cardBrand: "VCC",
      token: "gateway-token",
    }),
    insertPaymentToken: async () => ({
      id: "token-1",
      card_number_masked: "497010XXXXXX0048",
      card_brand: "VCC",
    }),
    recordCardTokenizedEvent: async () => {},
    checkRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
    ...overrides,
  };
}

function authRequest(body: unknown): Request {
  return new Request("https://example.com/tokenize-payment-card", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("missing user email returns HTTP 422", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      getUser: async () => ({ user: { id: "client-1", email: null }, error: null }),
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(tokenizeCalled, false);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "EMAIL_REQUIRED");
});

Deno.test("user email is forwarded to tokenization", async () => {
  let tokenizeEmail: string | undefined;

  await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async (input) => {
        tokenizeEmail = input.email;
        return {
          isActive: true,
          paymentProfileId: "403137",
          cardNumberMasked: "497010XXXXXX0048",
          cardBrand: "VCC",
          token: "gateway-token",
        };
      },
    }),
  );

  assertEquals(tokenizeEmail, "cliente@renovi.com.br");
});

Deno.test("missing cpf returns HTTP 422", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      phone: customerFields.phone,
    }),
    createDeps({
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(tokenizeCalled, false);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "CPF_REQUIRED");
});

Deno.test("missing phone returns HTTP 422", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      cpf: customerFields.cpf,
    }),
    createDeps({
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(tokenizeCalled, false);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "PHONE_REQUIRED");
});

Deno.test("cpf and phone from body are forwarded to tokenization", async () => {
  let tokenizeCpf: string | undefined;
  let tokenizePhone: string | undefined;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async (input) => {
        tokenizeCpf = input.cpf;
        tokenizePhone = input.phone;
        return {
          isActive: true,
          paymentProfileId: "403137",
          cardNumberMasked: "497010XXXXXX0048",
          cardBrand: "VCC",
          token: "gateway-token",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(tokenizeCpf, "03019758092");
  assertEquals(tokenizePhone, "48999999999");
});

Deno.test("inactive profile rejectedReason is returned as opaque CARD_REJECTED", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async () => ({
        isActive: false,
        errors: [{
          message: "Antifraud rejected the transaction",
          code: "PAYMENT_PROFILE_REJECTED",
        }],
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.message, "Card was rejected");
  assertEquals(body.errors?.[0]?.code, "CARD_REJECTED");
  assertEquals(
    JSON.stringify(body).includes("PAYMENT_PROFILE_REJECTED"),
    false,
  );
  assertEquals(JSON.stringify(body).includes("RISK_ANALYSIS_"), false);
});

Deno.test("gateway RISK_ANALYSIS codes are not exposed to tokenize clients", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      tokenizeContext: "profile",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async () => ({
        isActive: false,
        errors: [{
          message: "Suspeita de fraude",
          code: "RISK_ANALYSIS_FRAUD_SUSPICION",
        }],
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "CARD_REJECTED");
  assertEquals(JSON.stringify(body).includes("RISK_ANALYSIS_"), false);
});

Deno.test("missing billingAddress returns HTTP 422 before gateway call", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      providerServiceId: "proposal-1",
      ...customerFields,
      billingAddress: {
        street: "",
        number: "",
        district: "",
        city: "",
        state: "",
        zipCode: "",
      },
    }),
    createDeps({
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(tokenizeCalled, false);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "BILLING_ADDRESS_REQUIRED");
});

Deno.test("isActive=false returns HTTP 422 and does not persist token", async () => {
  let insertCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async () => ({
        isActive: false,
        errors: [{ message: "Card rejected", code: "REJECTED" }],
      }),
      insertPaymentToken: async () => {
        insertCalled = true;
        return null;
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(insertCalled, false);
});

Deno.test("successful tokenization persists token and returns masked metadata", async () => {
  let persistedCompanyId: string | null = null;
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      insertPaymentToken: async (input) => {
        persistedCompanyId = input.netcredCompanyId;
        return {
          id: "token-1",
          card_number_masked: "497010XXXXXX0048",
          card_brand: "VCC",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.payment_token_id, "token-1");
  assertEquals(body.card_number_masked, "497010XXXXXX0048");
  assertEquals(body.card_brand, "VCC");
  assertEquals(persistedCompanyId, "1014");
});

Deno.test("profile and checkout always use platform company", async () => {
  let resolvePlatformCalled = 0;
  let tokenizeCompanyId: string | undefined;

  const deps = createDeps({
    resolvePlatformCompany: async () => {
      resolvePlatformCalled += 1;
      return {
        providerUserId: "platform",
        netcredCompanyId: "1014",
      };
    },
    tokenizeCard: async (input) => {
      tokenizeCompanyId = input.customerInput.companyId;
      return {
        isActive: true,
        paymentProfileId: "403137",
        cardNumberMasked: "497010XXXXXX0048",
        cardBrand: "VCC",
        token: "gateway-token",
      };
    },
  });

  const profile = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      tokenizeContext: "profile",
      ...customerFields,
    }),
    deps,
  );
  assertEquals(profile.status, 200);
  assertEquals(tokenizeCompanyId, "1014");

  const checkout = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    deps,
  );
  assertEquals(checkout.status, 200);
  assertEquals(tokenizeCompanyId, "1014");
  assertEquals(resolvePlatformCalled >= 2, true);
});

Deno.test("checkout context validates proposal ownership before gateway call", async () => {
  let validateCalled = false;
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      validateCheckoutAccess: async (clientId, proposalId) => {
        validateCalled = true;
        assertEquals(clientId, "client-1");
        assertEquals(proposalId, "proposal-1");
      },
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return {
          isActive: true,
          paymentProfileId: "403137",
          cardNumberMasked: "497010XXXXXX0048",
          cardBrand: "VCC",
          token: "gateway-token",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(validateCalled, true);
  assertEquals(tokenizeCalled, true);
});

Deno.test("forbidden checkout access returns HTTP 403", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-foreign",
      ...customerFields,
    }),
    createDeps({
      validateCheckoutAccess: async () => {
        throw new Error("FORBIDDEN");
      },
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 403);
  assertEquals(tokenizeCalled, false);
});

Deno.test("handleRequest source does not log raw card fields", async () => {
  const source = await Deno.readTextFile(
    new URL("../handleRequest.ts", import.meta.url),
  );

  assertEquals(source.includes("cardData.cardNumber"), false);
  assertEquals(source.includes("cardData.cvv"), false);
  assertEquals(source.includes("logger.info("), false);
  assertEquals(source.includes("console.log("), false);
});

Deno.test("OPTIONS returns 204 and non-POST returns 405", async () => {
  const options = await handleTokenizePaymentCardRequest(
    new Request("https://example.com/tokenize-payment-card", { method: "OPTIONS" }),
    createDeps(),
  );
  assertEquals(options.status, 204);

  const get = await handleTokenizePaymentCardRequest(
    new Request("https://example.com/tokenize-payment-card", { method: "GET" }),
    createDeps(),
  );
  assertEquals(get.status, 405);
});

Deno.test("rate limit exceeded returns HTTP 429 with Retry-After", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      checkRateLimit: async () => ({
        allowed: false,
        remaining: 0,
        retryAfter: 30,
      }),
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "30");
  const body = await response.json();
  assertEquals(body.error, "rate_limited");
});

Deno.test("profile tokenize enforces 3/min then daily cap keys", async () => {
  const calls: Array<{
    functionName: string;
    perMinute: number;
    windowMs?: number;
  }> = [];

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      tokenizeContext: "profile",
      ...customerFields,
    }),
    createDeps({
      checkRateLimit: async (_ip, _userId, functionName, config) => {
        calls.push({
          functionName,
          perMinute: config.perMinute,
          windowMs: config.windowMs,
        });
        return { allowed: true, remaining: 1, retryAfter: 0 };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(calls.length, 2);
  assertEquals(calls[0]?.functionName, "tokenize-payment-card:profile");
  assertEquals(calls[0]?.perMinute, 3);
  assertEquals(calls[1]?.functionName, "tokenize-payment-card:profile:daily");
  assertEquals(calls[1]?.perMinute, 30);
  assertEquals(calls[1]?.windowMs, 86_400_000);
});

Deno.test("profile daily cap exceeded returns HTTP 429", async () => {
  let call = 0;
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      tokenizeContext: "profile",
      ...customerFields,
    }),
    createDeps({
      checkRateLimit: async () => {
        call += 1;
        if (call === 1) {
          return { allowed: true, remaining: 2, retryAfter: 0 };
        }
        return { allowed: false, remaining: 0, retryAfter: 3600 };
      },
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "3600");
  const body = await response.json();
  assertEquals(body.error, "rate_limited");
});

Deno.test("checkout tokenize uses checkout per-minute key only", async () => {
  const calls: string[] = [];

  await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      checkRateLimit: async (_ip, _userId, functionName) => {
        calls.push(functionName);
        return { allowed: true, remaining: 9, retryAfter: 0 };
      },
    }),
  );

  assertEquals(calls, ["tokenize-payment-card:checkout"]);
});

Deno.test("checkout tokenize does not require provider credentialing (platform merchant)", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps(),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.payment_token_id, "token-1");
});

Deno.test("persist failure returns HTTP 500", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      insertPaymentToken: async () => null,
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "failed_to_persist_payment_token");
});

Deno.test("invalid CPF returns HTTP 422 before gateway call", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      cpf: "123.456.789-00",
      phone: customerFields.phone,
    }),
    createDeps({
      tokenizeCard: async () => {
        tokenizeCalled = true;
        return { isActive: true };
      },
    }),
  );

  assertEquals(response.status, 422);
  assertEquals(tokenizeCalled, false);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "CPF_INVALID");
});

Deno.test("incomplete cardData returns HTTP 400", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData: { ...cardData, cardNumber: "" },
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps(),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "cardData is incomplete");
});

Deno.test("missing Authorization returns HTTP 401", async () => {
  const response = await handleTokenizePaymentCardRequest(
    new Request("https://example.com/tokenize-payment-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardData,
        billingAddress,
        providerServiceId: "proposal-1",
        ...customerFields,
      }),
    }),
    createDeps(),
  );

  assertEquals(response.status, 401);
});

Deno.test("invalid JWT user returns HTTP 401", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      getUser: async () => ({ user: null, error: new Error("invalid") }),
    }),
  );
  assertEquals(response.status, 401);
});

Deno.test("invalid JSON body returns HTTP 400", async () => {
  const response = await handleTokenizePaymentCardRequest(
    new Request("https://example.com/tokenize-payment-card", {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt-token",
        "Content-Type": "application/json",
      },
      body: "{not-json",
    }),
    createDeps(),
  );
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid JSON body");
});

Deno.test("inactive tokenization without errors array still returns 422", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async () => ({
        isActive: false,
      }),
    }),
  );
  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "CARD_REJECTED");
  assertEquals(body.errors?.[0]?.message, "Card was rejected");
});

Deno.test("inactive tokenization with empty errors array returns opaque CARD_REJECTED", async () => {
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      ...customerFields,
    }),
    createDeps({
      tokenizeCard: async () => ({
        isActive: false,
        errors: [],
      }),
    }),
  );
  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.errors?.[0]?.code, "CARD_REJECTED");
  assertEquals(JSON.stringify(body).includes("RISK_ANALYSIS_"), false);
});
