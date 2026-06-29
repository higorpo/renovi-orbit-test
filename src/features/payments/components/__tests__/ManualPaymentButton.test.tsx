// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualPaymentButton } from "../ManualPaymentButton";

describe("ManualPaymentButton", () => {
  it("is hidden for SCHEDULED, PAID, and CANCELLED states", () => {
    const onClick = vi.fn();

    const { rerender } = render(
      <ManualPaymentButton scheduleState="SCHEDULED" onClick={onClick} />,
    );
    expect(screen.queryByRole("button", { name: /Efetuar Pagamento/i })).toBeNull();

    rerender(<ManualPaymentButton scheduleState="PAID" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: /Efetuar Pagamento/i })).toBeNull();

    rerender(<ManualPaymentButton scheduleState="CANCELLED" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: /Efetuar Pagamento/i })).toBeNull();
  });

  it("renders for FAILED and FAILED_PERMANENT states", () => {
    const onClick = vi.fn();

    render(<ManualPaymentButton scheduleState="FAILED" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: /Efetuar Pagamento/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
