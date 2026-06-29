// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentHistorySection } from "../PaymentHistorySection";

vi.mock("../ClientPaymentHistoryList", () => ({
  ClientPaymentHistoryList: () => <div data-testid="client-payment-history">Client history</div>,
}));

vi.mock("../ProviderPaymentHistoryList", () => ({
  ProviderPaymentHistoryList: () => <div data-testid="provider-payment-history">Provider history</div>,
}));

describe("PaymentHistorySection", () => {
  it("renders client history for client role", () => {
    render(<PaymentHistorySection role="client" />);
    expect(screen.getByTestId("client-payment-history")).toBeInTheDocument();
  });

  it("renders provider history for provider role", () => {
    render(<PaymentHistorySection role="provider" />);
    expect(screen.getByTestId("provider-payment-history")).toBeInTheDocument();
  });
});
