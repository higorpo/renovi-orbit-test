// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnrichmentProcessingBanner } from "../EnrichmentProcessingBanner";

describe("EnrichmentProcessingBanner", () => {
  it("shows processing copy for PENDING", () => {
    render(<EnrichmentProcessingBanner enrichmentStatus="PENDING" />);
    expect(screen.getByTestId("enrichment-processing-banner")).toHaveTextContent(
      /em processamento/i,
    );
  });

  it("hides when READY", () => {
    const { container } = render(
      <EnrichmentProcessingBanner enrichmentStatus="READY" enrichmentReady />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides when status is null", () => {
    const { container } = render(
      <EnrichmentProcessingBanner enrichmentStatus={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows aborted messaging", () => {
    render(<EnrichmentProcessingBanner enrichmentStatus="ABORTED" />);
    const banner = screen.getByTestId("enrichment-processing-banner");
    expect(banner).toHaveAttribute("data-kind", "aborted");
    expect(banner).toHaveTextContent(/interrompida/i);
  });

  it("shows cancelled messaging over RUNNING enrichment", () => {
    render(
      <EnrichmentProcessingBanner
        enrichmentStatus="RUNNING"
        requestStatus="CANCELLED"
      />,
    );
    const banner = screen.getByTestId("enrichment-processing-banner");
    expect(banner).toHaveAttribute("data-kind", "cancelled");
    expect(banner).toHaveTextContent(/cancelado/i);
  });
});
