import { describe, it, expect } from "vitest";
import {
  addressFormSchema,
  defaultAddressFormData,
  type AddressFormData,
} from "../addressForm.validation";

const validFormData: AddressFormData = {
  address_zip: "01310-100",
  address_street: "Avenida Paulista",
  address_number: "1000",
  address_complement: "",
  address_neighborhood_id: "11111111-1111-4111-8111-111111111111",
  address_neighborhood: "Bela Vista",
  address_state_id: "22222222-2222-4222-8222-222222222222",
  address_state: "SP",
  address_city_id: "33333333-3333-4333-8333-333333333333",
  address_city: "São Paulo",
};

describe("addressFormSchema", () => {
  it("accepts valid form data", () => {
    const result = addressFormSchema.safeParse(validFormData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid CEP format", () => {
    const result = addressFormSchema.safeParse({
      ...validFormData,
      address_zip: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short street", () => {
    const result = addressFormSchema.safeParse({
      ...validFormData,
      address_street: "Ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty number", () => {
    const result = addressFormSchema.safeParse({
      ...validFormData,
      address_number: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID neighborhood_id", () => {
    const result = addressFormSchema.safeParse({
      ...validFormData,
      address_neighborhood_id: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects state not 2 chars", () => {
    const result = addressFormSchema.safeParse({
      ...validFormData,
      address_state: "SPP",
    });
    expect(result.success).toBe(false);
  });
});

describe("defaultAddressFormData", () => {
  it("returns all fields empty strings", () => {
    const data = defaultAddressFormData;
    expect(data.address_zip).toBe("");
    expect(data.address_street).toBe("");
    expect(data.address_number).toBe("");
    expect(data.address_complement).toBe("");
    expect(data.address_neighborhood_id).toBe("");
    expect(data.address_neighborhood).toBe("");
    expect(data.address_state_id).toBe("");
    expect(data.address_state).toBe("");
    expect(data.address_city_id).toBe("");
    expect(data.address_city).toBe("");
  });
});
