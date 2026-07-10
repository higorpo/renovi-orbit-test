import { describe, expect, it } from "vitest";
import { formatFullAddress } from "../formatFullAddress";
import type { ServiceModel } from "../../types/service.types";

function model(address: ServiceModel["address"]): Pick<ServiceModel, "address"> {
  return { address } as Pick<ServiceModel, "address">;
}

describe("formatFullAddress", () => {
  it("returns fallback when address is missing", () => {
    expect(formatFullAddress(model(null) as ServiceModel)).toBe("Endereço não informado");
  });

  it("joins street, complement, locality with state, and zip", () => {
    expect(
      formatFullAddress(
        model({
          street: "Rua A",
          number: "10",
          complement: "Apto 2",
          neighborhood: "Centro",
          cityName: "Florianópolis",
          stateAbbreviation: "SC",
          zipCode: "88010-000",
        }) as ServiceModel,
      ),
    ).toBe(
      "Rua A, 10 | Complemento: Apto 2 | Centro, Florianópolis - SC | CEP: 88010-000",
    );
  });

  it("omits empty parts and keeps state when locality is absent", () => {
    expect(
      formatFullAddress(
        model({
          street: "Rua B",
          number: "",
          neighborhood: "",
          cityName: "",
          stateAbbreviation: "SP",
        }) as ServiceModel,
      ),
    ).toBe("Rua B | SP");
  });

  it("shows locality without state when abbreviation is missing", () => {
    expect(
      formatFullAddress(
        model({
          neighborhood: "Centro",
          cityName: "Curitiba",
        }) as ServiceModel,
      ),
    ).toBe("Centro, Curitiba");
  });
});
