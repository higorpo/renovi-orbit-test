import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceRequestProposalSummaryCardSkeleton } from "../ServiceRequestProposalSummaryCardSkeleton";

describe("ServiceRequestProposalSummaryCardSkeleton", () => {
  it("renders a busy loading card for the sent proposal summary", () => {
    render(<ServiceRequestProposalSummaryCardSkeleton />);
    expect(screen.getByLabelText(/Carregando orçamento enviado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carregando orçamento enviado/i)).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
