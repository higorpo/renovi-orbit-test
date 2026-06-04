import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalClientRejectionNotice } from "../ProposalClientRejectionNotice";

describe("ProposalClientRejectionNotice", () => {
  it("renders client rejection response when provided", () => {
    render(
      <ProposalClientRejectionNotice clientRejectionResponse="  Preço acima do orçamento  " />,
    );

    expect(screen.getByText("Resposta do cliente sobre a rejeição")).toBeInTheDocument();
    expect(screen.getByText("Preço acima do orçamento")).toBeInTheDocument();
  });

  it("renders nothing when response is empty", () => {
    const { container } = render(
      <ProposalClientRejectionNotice clientRejectionResponse="   " />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
