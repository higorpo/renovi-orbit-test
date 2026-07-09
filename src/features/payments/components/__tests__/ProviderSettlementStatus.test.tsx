import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderSettlementStatus } from "../ProviderSettlementStatus";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

vi.mock("../ProviderSettlementDisclosure", () => ({
  ProviderSettlementDisclosure: ({
    capturePaidAt,
    showCompletionNote,
  }: {
    capturePaidAt: string;
    showCompletionNote?: boolean;
  }) => (
    <div data-testid="settlement-disclosure">
      {capturePaidAt}
      {showCompletionNote ? " with-note" : ""}
    </div>
  ),
}));

describe("ProviderSettlementStatus", () => {
  it("returns null for non-paid schedule states", () => {
    mockUsePaymentSchedule.mockReturnValue({
      data: {
        schedule: {
          state: "AUTHORIZED",
          paidAt: "2026-07-01T00:00:00.000Z",
        },
      },
    });

    const { container } = render(
      <ProviderSettlementStatus contractedServiceId="service-1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders disclosure for paid schedules", () => {
    mockUsePaymentSchedule.mockReturnValue({
      data: {
        schedule: {
          state: "PAID",
          paidAt: "2026-07-01T00:00:00.000Z",
        },
      },
    });

    render(<ProviderSettlementStatus contractedServiceId="service-1" />);

    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent(
      "2026-07-01T00:00:00.000Z",
    );
    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent("with-note");
  });
});
