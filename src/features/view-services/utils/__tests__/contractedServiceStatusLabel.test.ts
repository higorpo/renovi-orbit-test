import { describe, expect, it } from "vitest";
import { getContractedServiceStatusLabel } from "../contractedServiceStatusLabel";

describe("getContractedServiceStatusLabel", () => {
  it("maps known contracted_service_status values to pt-BR labels", () => {
    expect(getContractedServiceStatusLabel("PENDING_PAYMENT")).toBe(
      "Aguardando pagamento",
    );
    expect(getContractedServiceStatusLabel("CONFIRMED")).toBe("Confirmado");
    expect(getContractedServiceStatusLabel("EXECUTED")).toBe("Executado");
    expect(getContractedServiceStatusLabel("IN_DISPUTE")).toBe("Em disputa");
    expect(getContractedServiceStatusLabel("COMPLETED")).toBe("Concluído");
    expect(getContractedServiceStatusLabel("CANCELLED")).toBe("Cancelado");
  });

  it("returns the raw status when unknown", () => {
    expect(getContractedServiceStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
