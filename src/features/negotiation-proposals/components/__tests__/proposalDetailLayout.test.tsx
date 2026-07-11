import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapPin } from "lucide-react";
import {
  ProposalDetailLabel,
  ProposalDetailSection,
  ProposalDetailValue,
} from "../proposalDetailLayout";

describe("proposalDetailLayout", () => {
  it("renders muted section variant", () => {
    const { container } = render(
      <ProposalDetailSection variant="muted" className="extra">
        Content
      </ProposalDetailSection>,
    );

    expect(container.firstChild).toHaveClass("bg-muted/20", "extra");
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders label with optional icon and emphasis", () => {
    render(
      <ProposalDetailLabel icon={MapPin} emphasized>
        Local
      </ProposalDetailLabel>,
    );

    expect(screen.getByText("Local")).toHaveClass("font-medium");
  });

  it("renders value with spacing and semibold options", () => {
    const { rerender } = render(
      <ProposalDetailValue semibold spacing="relaxed">
        R$ 100
      </ProposalDetailValue>,
    );

    expect(screen.getByText("R$ 100")).toHaveClass("font-semibold", "mt-2");

    rerender(<ProposalDetailValue>R$ 50</ProposalDetailValue>);
    expect(screen.getByText("R$ 50")).toHaveClass("mt-1");
  });
});
