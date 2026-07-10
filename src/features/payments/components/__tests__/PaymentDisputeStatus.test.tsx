import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentDisputeStatus } from "../PaymentDisputeStatus";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

describe("PaymentDisputeStatus", () => {
  it("returns null when schedule is not disputed", () => {
    mockUsePaymentSchedule.mockReturnValue({
      data: { schedule: { isDisputed: false } },
    });

    const { container } = render(
      <PaymentDisputeStatus contractedServiceId="service-1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders dispute badge when schedule is disputed", () => {
    mockUsePaymentSchedule.mockReturnValue({
      data: { schedule: { isDisputed: true } },
    });

    render(<PaymentDisputeStatus contractedServiceId="service-1" />);

    expect(screen.getByText("Chargeback em análise")).toBeInTheDocument();
  });
});
