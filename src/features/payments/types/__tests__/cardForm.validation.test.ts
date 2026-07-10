import { describe, expect, it } from "vitest";
import { cardFormSchema, defaultCardFormValues } from "../cardForm.validation";

const validBase = {
  cardNumber: "4111111111111111",
  expiryMonth: "10",
  expiryYear: "30",
  cvv: "123",
  cardholderName: "Maria da Silva",
  cardholderCpf: "390.533.447-05",
  street: "Rua A",
  number: "100",
  additionalDetails: "",
  district: "Centro",
  city: "Florianópolis",
  state: "sc",
  zipCode: "88010000",
};

describe("cardFormSchema", () => {
  it("accepts a valid card form", () => {
    const result = cardFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe("SC");
    }
  });

  it("rejects invalid card number, CVV, and expired cards", () => {
    expect(
      cardFormSchema.safeParse({
        ...validBase,
        cardNumber: "1234",
      }).success,
    ).toBe(false);

    expect(
      cardFormSchema.safeParse({
        ...validBase,
        cvv: "12",
      }).success,
    ).toBe(false);

    expect(
      cardFormSchema.safeParse({
        ...validBase,
        expiryMonth: "01",
        expiryYear: "20",
      }).success,
    ).toBe(false);
  });

  it("rejects missing or invalid cardholder CPF", () => {
    expect(
      cardFormSchema.safeParse({
        ...validBase,
        cardholderCpf: "",
      }).success,
    ).toBe(false);

    expect(
      cardFormSchema.safeParse({
        ...validBase,
        cardholderCpf: "111.111.111-11",
      }).success,
    ).toBe(false);
  });
});

describe("defaultCardFormValues", () => {
  it("returns empty card, cardholder CPF, and billing fields", () => {
    expect(defaultCardFormValues().cardholderCpf).toBe("");
    expect(defaultCardFormValues().cardNumber).toBe("");
  });
});
