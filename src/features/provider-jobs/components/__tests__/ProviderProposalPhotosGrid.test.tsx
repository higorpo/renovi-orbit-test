import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderProposalPhotosGrid } from "../ProviderProposalPhotosGrid";

describe("ProviderProposalPhotosGrid", () => {
  it("returns null when not loading and there are no urls", () => {
    const { container } = render(
      <ProviderProposalPhotosGrid
        isLoading={false}
        urls={[]}
        fallbackPhotos={["a.jpg"]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows pulse placeholders from fallback photos while loading", () => {
    const { container } = render(
      <ProviderProposalPhotosGrid
        isLoading
        urls={[]}
        fallbackPhotos={["1", "2", "3"]}
      />,
    );
    expect(screen.getByText(/fotos do orçamento/i)).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders resolved image urls when loaded", () => {
    render(
      <ProviderProposalPhotosGrid
        isLoading={false}
        urls={["https://cdn.example/1.jpg"]}
        fallbackPhotos={[]}
      />,
    );
    const img = screen.getByRole("img", { name: /foto do orçamento 1/i });
    expect(img).toHaveAttribute("src", "https://cdn.example/1.jpg");
  });

  it("uses empty fallback list when fallbackPhotos is null", () => {
    const { container } = render(
      <ProviderProposalPhotosGrid isLoading urls={[]} fallbackPhotos={null} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});
