// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualPaymentFailureAlert } from "../ManualPaymentFailureAlert";

describe("ManualPaymentFailureAlert", () => {
  it("is hidden when schedule is not eligible for manual payment", () => {
    const { rerender } = render(
      <ManualPaymentFailureAlert scheduleState="SCHEDULED" />,
    );
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<ManualPaymentFailureAlert scheduleState="PAID" />);
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<ManualPaymentFailureAlert scheduleState={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows failure alert for FAILED and FAILED_PERMANENT", () => {
    const { rerender } = render(
      <ManualPaymentFailureAlert scheduleState="FAILED" />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Pagamento falhou")).toBeInTheDocument();
    expect(
      screen.getByText(/cancelado automaticamente perto da data agendada/i),
    ).toBeInTheDocument();

    rerender(<ManualPaymentFailureAlert scheduleState="FAILED_PERMANENT" />);
    expect(screen.getByText("Pagamento falhou")).toBeInTheDocument();
  });

  it("shows mapped risk-analysis message when failureCode is present", () => {
    render(
      <ManualPaymentFailureAlert
        scheduleState="FAILED_PERMANENT"
        failureCode="RISK_ANALYSIS_FRAUD_SUSPICION"
      />,
    );

    expect(
      screen.getByText(/recusado pela análise de segurança/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/ClearSale/i),
    ).toBeNull();
  });
});
