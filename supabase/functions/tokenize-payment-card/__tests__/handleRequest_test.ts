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

function createDeps(overrides: Partial<TokenizePaymentCardDeps> = {}): TokenizePaymentCardDeps {
  return {
    getUser: async () => ({ user: { id: "client-1" }, error: null }),
    validateCheckoutAccess: async () => {},
    resolveProviderAccount: async () => ({
      providerUserId: "provider-1",
      netcredCompanyId: "1048",
    }),
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

Deno.test("missing billingAddress returns HTTP 422 before gateway call", async () => {
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      providerServiceId: "proposal-1",
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
  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
      cpf: "03019758092",
    }),
    createDeps(),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.payment_token_id, "token-1");
  assertEquals(body.card_number_masked, "497010XXXXXX0048");
  assertEquals(body.card_brand, "VCC");
});

Deno.test("profile context uses platform company without providerServiceId", async () => {
  let resolveProviderCalled = false;
  let resolvePlatformCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      tokenizeContext: "profile",
    }),
    createDeps({
      resolveProviderAccount: async () => {
        resolveProviderCalled = true;
        return null;
      },
      resolvePlatformCompany: async () => {
        resolvePlatformCalled = true;
        return {
          providerUserId: "platform",
          netcredCompanyId: "1014",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(resolveProviderCalled, false);
  assertEquals(resolvePlatformCalled, true);
});

Deno.test("checkout context validates proposal ownership before gateway call", async () => {
  let validateCalled = false;
  let tokenizeCalled = false;

  const response = await handleTokenizePaymentCardRequest(
    authRequest({
      cardData,
      billingAddress,
      providerServiceId: "proposal-1",
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
