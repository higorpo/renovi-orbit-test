import { describe, expect, it } from "vitest";
import { createCardFormSchema, defaultCardFormValues } from "../cardForm.validation";

const validBase = {
  cardNumber: "4111111111111111",
  expiryMonth: "10",
  expiryYear: "30",
  cvv: "123",
  cardholderName: "Maria da Silva",
  street: "Rua A",
  number: "100",
  additionalDetails: "",
  district: "Centro",
  city: "Florianópolis",
  state: "sc",
  zipCode: "88010000",
};

describe("createCardFormSchema", () => {
  it("accepts a valid card form without CPF", () => {
    const result = createCardFormSchema(false).safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe("SC");
    }
  });

  it("requires CPF when collectCpf is true", () => {
    expect(createCardFormSchema(true).safeParse(validBase).success).toBe(false);
    expect(
      createCardFormSchema(true).safeParse({
        ...validBase,
        cpf: "390.533.447-05",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid card number, CVV, and expired cards", () => {
    expect(
      createCardFormSchema(false).safeParse({
        ...validBase,
        cardNumber: "1234",
      }).success,
    ).toBe(false);

    expect(
      createCardFormSchema(false).safeParse({
        ...validBase,
        cvv: "12",
      }).success,
    ).toBe(false);

    expect(
      createCardFormSchema(false).safeParse({
        ...validBase,
        expiryMonth: "01",
        expiryYear: "20",
      }).success,
    ).toBe(false);
  });
});

describe("defaultCardFormValues", () => {
  it("includes cpf only when collectCpf is true", () => {
    expect(defaultCardFormValues(false)).not.toHaveProperty("cpf");
    expect(defaultCardFormValues(true)).toMatchObject({ cpf: "" });
  });
});
