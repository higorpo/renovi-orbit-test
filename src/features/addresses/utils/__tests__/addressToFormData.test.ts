import { describe, it, expect } from "vitest";
import { addressToFormData } from "../addressToFormData";
import type { ClientAddressWithRelations } from "../../types/addresses.types";

describe("addressToFormData", () => {
  it("maps address with relations to form data with masked CEP", () => {
    const addr: ClientAddressWithRelations = {
      id: "addr-1",
      client_id: "user-1",
      label: "Casa",
      street: "Avenida Paulista",
      number: "1000",
      complement: "Sala 1",
      neighborhood: "Bela Vista",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "01310100",
      is_default: true,
      is_active: true,
      created_at: "",
      updated_at: "",
      platform_cities: { name: "São Paulo" },
      platform_states: { abbreviation: "SP" },
    } as ClientAddressWithRelations;

    const result = addressToFormData(addr);

    expect(result.address_label).toBe("Casa");
    expect(result.address_zip).toBe("01310-100");
    expect(result.address_street).toBe("Avenida Paulista");
    expect(result.address_number).toBe("1000");
    expect(result.address_complement).toBe("Sala 1");
    expect(result.address_neighborhood).toBe("Bela Vista");
    expect(result.address_neighborhood_id).toBe("");
    expect(result.address_state_id).toBe("state-1");
    expect(result.address_state).toBe("SP");
    expect(result.address_city_id).toBe("city-1");
    expect(result.address_city).toBe("São Paulo");
  });

  it("uses empty complement and empty relation names when null", () => {
    const addr: ClientAddressWithRelations = {
      id: "addr-1",
      client_id: "user-1",
      label: "Casa",
      street: "Rua X",
      number: "1",
      complement: null,
      neighborhood: "Centro",
      city_id: "city-1",
      state_id: "state-1",
      zip_code: "88015100",
      is_default: false,
      is_active: true,
      created_at: "",
      updated_at: "",
      platform_cities: null,
      platform_states: null,
    } as ClientAddressWithRelations;

    const result = addressToFormData(addr);

    expect(result.address_complement).toBe("");
    expect(result.address_state).toBe("");
    expect(result.address_city).toBe("");
  });
});
