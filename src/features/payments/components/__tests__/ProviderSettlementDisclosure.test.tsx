import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderSettlementDisclosure } from "../ProviderSettlementDisclosure";

vi.mock("../../utils/providerSettlementDisclosure", async () => {
  const actual = await vi.importActual<typeof import("../../utils/providerSettlementDisclosure")>(
    "../../utils/providerSettlementDisclosure",
  );
  return {
    ...actual,
    formatProviderSettlementDisclosure: vi.fn((capturePaidAt: string) => {
      if (capturePaidAt === "invalid") return null;
      return "Previsão de depósito na conta: 01 de agosto de 2026";
    }),
  };
});

describe("ProviderSettlementDisclosure", () => {
  it("returns null when disclosure cannot be formatted", () => {
    const { container } = render(
      <ProviderSettlementDisclosure capturePaidAt="invalid" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders disclosure and optional completion note", () => {
    render(
      <ProviderSettlementDisclosure
        capturePaidAt="2026-07-01T00:00:00.000Z"
        showCompletionNote
      />,
    );

    expect(screen.getByText(/Previsão de depósito na conta/i)).toBeInTheDocument();
    expect(screen.getByText(/Marcar o serviço como concluído/i)).toBeInTheDocument();
  });
});
