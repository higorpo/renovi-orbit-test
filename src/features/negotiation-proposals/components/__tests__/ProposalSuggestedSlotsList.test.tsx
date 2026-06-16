import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalSuggestedSlotsList } from "../ProposalSuggestedSlotsList";

describe("ProposalSuggestedSlotsList", () => {
  it("renders formatted suggested slots", () => {
    render(
      <ProposalSuggestedSlotsList
        slots={[
          { start_date: "2026-06-10", shift: "morning" },
          { start_date: "2026-06-12", shift: "afternoon" },
        ]}
      />,
    );

    expect(screen.getByText(/Datas sugeridas para execução/i)).toBeInTheDocument();
    expect(screen.getByText(/Opção 1:/)).toBeInTheDocument();
    expect(screen.getByText(/Opção 2:/)).toBeInTheDocument();
    expect(screen.getByText(/Manhã/)).toBeInTheDocument();
    expect(screen.getByText(/Tarde/)).toBeInTheDocument();
  });

  it("renders nothing when slots are empty", () => {
    const { container } = render(<ProposalSuggestedSlotsList slots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
