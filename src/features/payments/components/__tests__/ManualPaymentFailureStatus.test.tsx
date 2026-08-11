// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManualPaymentFailureStatus } from "../ManualPaymentFailureStatus";

const mockUsePaymentSchedule = vi.fn();

vi.mock("../../hooks/usePaymentSchedule", () => ({
  usePaymentSchedule: (...args: unknown[]) => mockUsePaymentSchedule(...args),
}));

describe("ManualPaymentFailureStatus", () => {
  beforeEach(() => {
    mockUsePaymentSchedule.mockReset();
  });

  it("renders failure alert when schedule is eligible", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: false,
      data: {
        schedule: { state: "FAILED", failureCode: null },
      },
    });

    render(<ManualPaymentFailureStatus contractedServiceId="cs-1" />);

    expect(screen.getByText("Pagamento falhou")).toBeInTheDocument();
  });

  it("returns null while loading or when not eligible", () => {
    mockUsePaymentSchedule.mockReturnValue({
      isLoading: true,
      data: undefined,
    });
    const { rerender, container } = render(
      <ManualPaymentFailureStatus contractedServiceId="cs-1" />,
    );
    expect(container).toBeEmptyDOMElement();

    mockUsePaymentSchedule.mockReturnValue({
      isLoading: false,
      data: { schedule: { state: "PAID", failureCode: null } },
    });
    rerender(<ManualPaymentFailureStatus contractedServiceId="cs-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
