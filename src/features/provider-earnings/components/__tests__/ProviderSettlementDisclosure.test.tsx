import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderSettlementDisclosure } from "../ProviderSettlementDisclosure";

vi.mock("../../utils/providerSettlementDisclosure", async () => {
  const actual = await vi.importActual<
    typeof import("../../utils/providerSettlementDisclosure")
  >("../../utils/providerSettlementDisclosure");
  return {
    ...actual,
    formatProviderSettlementDisclosure: vi.fn(
      (capturePaidAt: string, options?: { settlingAt?: string | null }) => {
        if (capturePaidAt === "invalid" && !options?.settlingAt) return null;
        if (options?.settlingAt) {
          return `Previsão de depósito na conta: ${options.settlingAt}`;
        }
        return "Previsão de depósito na conta: 01 de agosto de 2026";
      },
    ),
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

  it("prefers settlingAt when provided", () => {
    render(
      <ProviderSettlementDisclosure
        capturePaidAt="2026-07-01T00:00:00.000Z"
        settlingAt="2026-08-15"
      />,
    );

    expect(screen.getByText(/2026-08-15/)).toBeInTheDocument();
  });

  it("applies custom className and omits completion note by default", () => {
    render(
      <ProviderSettlementDisclosure
        capturePaidAt="2026-07-01T00:00:00.000Z"
        className="custom-settlement"
      />,
    );

    expect(screen.getByText(/Previsão de depósito na conta/i).closest("p")).toHaveClass(
      "custom-settlement",
    );
    expect(screen.queryByText(/Marcar o serviço como concluído/i)).toBeNull();
  });

  it("shows hold disclosure instead of deposit estimate when settlement is on hold", () => {
    render(
      <ProviderSettlementDisclosure
        capturePaidAt="2026-07-01T00:00:00.000Z"
        settlementOnHold
        holdReason="dispute"
        showCompletionNote
      />,
    );

    expect(
      screen.getByText(/Há um chargeback em análise/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Marcar o serviço como concluído/i)).toBeNull();
  });
});
