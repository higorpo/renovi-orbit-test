import { assertEquals } from "std/testing/asserts";
import { isValidCpf, normalizeCpf } from "../validateCpf.ts";
import { validateTokenizePaymentCardBody } from "../validateRequest.ts";

Deno.test("isValidCpf accepts valid CPF", () => {
  assertEquals(isValidCpf("030.197.580-92"), true);
  assertEquals(normalizeCpf("030.197.580-92"), "03019758092");
});

Deno.test("isValidCpf rejects invalid CPF", () => {
  assertEquals(isValidCpf("504.432.630-51"), false);
});

const validCustomer = {
  cpf: "030.197.580-92",
  phone: "(48) 99999-9999",
};

const validCardPayload = {
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
  ...validCustomer,
};

Deno.test("validateTokenizePaymentCardBody rejects missing providerServiceId for checkout", () => {
  const result = validateTokenizePaymentCardBody({});
  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.status, 400);
  }
});

Deno.test("validateTokenizePaymentCardBody accepts profile context without providerServiceId", () => {
  const result = validateTokenizePaymentCardBody({
    tokenizeContext: "profile",
    ...validCardPayload,
  });

  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.tokenizeContext, "profile");
    assertEquals(result.providerServiceId, undefined);
    assertEquals(result.cpf, "03019758092");
    assertEquals(result.phone, "48999999999");
  }
});

Deno.test("validateTokenizePaymentCardBody rejects missing cpf", () => {
  const result = validateTokenizePaymentCardBody({
    tokenizeContext: "profile",
    ...validCardPayload,
    cpf: undefined,
  });

  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.errors?.[0]?.code, "CPF_REQUIRED");
  }
});

Deno.test("validateTokenizePaymentCardBody rejects missing phone", () => {
  const result = validateTokenizePaymentCardBody({
    tokenizeContext: "profile",
    ...validCardPayload,
    phone: undefined,
  });

  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.errors?.[0]?.code, "PHONE_REQUIRED");
  }
});
