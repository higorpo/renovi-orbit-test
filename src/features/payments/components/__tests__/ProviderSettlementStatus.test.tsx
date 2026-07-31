import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderSettlementStatus } from "../ProviderSettlementStatus";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

vi.mock("@/features/provider-earnings", () => ({
  ProviderSettlementDisclosure: ({
    capturePaidAt,
    showCompletionNote,
    settlementOnHold,
    holdReason,
  }: {
    capturePaidAt: string;
    showCompletionNote?: boolean;
    settlementOnHold?: boolean;
    holdReason?: string;
  }) => (
    <div data-testid="settlement-disclosure">
      {settlementOnHold ? `hold:${holdReason}` : capturePaidAt}
      {!settlementOnHold && showCompletionNote ? " with-note" : ""}
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
          isDisputed: false,
        },
      },
    });

    render(<ProviderSettlementStatus contractedServiceId="service-1" />);

    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent(
      "2026-07-01T00:00:00.000Z",
    );
    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent("with-note");
  });

  it("shows hold disclosure for REFUND_REQUESTED and disputes", () => {
    mockUsePaymentSchedule.mockReturnValue({
      data: {
        schedule: {
          state: "REFUND_REQUESTED",
          paidAt: "2026-07-01T00:00:00.000Z",
          isDisputed: false,
        },
      },
    });

    const { rerender } = render(
      <ProviderSettlementStatus contractedServiceId="service-1" />,
    );

    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent("hold:refund");

    mockUsePaymentSchedule.mockReturnValue({
      data: {
        schedule: {
          state: "PAID",
          paidAt: "2026-07-01T00:00:00.000Z",
          isDisputed: true,
        },
      },
    });
    rerender(<ProviderSettlementStatus contractedServiceId="service-1" />);
    expect(screen.getByTestId("settlement-disclosure")).toHaveTextContent("hold:dispute");
  });
});
