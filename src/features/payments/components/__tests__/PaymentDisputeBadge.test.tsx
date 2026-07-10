import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentDisputeBadge } from "../PaymentDisputeBadge";

describe("PaymentDisputeBadge", () => {
  it("renders neutral dispute label", () => {
    render(<PaymentDisputeBadge />);

    expect(screen.getByText("Chargeback em análise")).toBeInTheDocument();
  });
});
