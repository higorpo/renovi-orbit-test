import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetCompareGuidancePanel } from "../BudgetCompareGuidancePanel";
import { BudgetCompareTrustPanel } from "../BudgetCompareTrustPanel";
import { ProposalPhotosGrid } from "../ProposalPhotosGrid";

describe("BudgetCompareGuidancePanel", () => {
  it("lists comparison tips by default", () => {
    render(<BudgetCompareGuidancePanel />);

    expect(
      screen.getByText("Como escolher o melhor orçamento?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Experiência do profissional")).toBeInTheDocument();
    expect(screen.getByText("Custo-benefício, não só preço")).toBeInTheDocument();
  });
});

describe("BudgetCompareTrustPanel", () => {
  it("renders trust items under the security section", () => {
    render(<BudgetCompareTrustPanel />);

    expect(screen.getByLabelText("Segurança Prestway")).toBeInTheDocument();
    expect(screen.getByText("Pagamento protegido")).toBeInTheDocument();
    expect(screen.getByText("Profissionais verificados")).toBeInTheDocument();
    expect(screen.getByText("Suporte Prestway")).toBeInTheDocument();
  });
});

describe("ProposalPhotosGrid", () => {
  it("returns null when idle with no urls", () => {
    const { container } = render(
      <ProposalPhotosGrid isLoading={false} urls={[]} fallbackPhotos={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows skeleton while loading", () => {
    render(
      <ProposalPhotosGrid
        isLoading
        urls={[]}
        fallbackPhotos={["a", "b"]}
        heading="Fotos do orçamento"
      />,
    );

    expect(screen.getByText("Fotos do orçamento")).toBeInTheDocument();
  });

  it("renders photo tiles with alt text", () => {
    render(
      <ProposalPhotosGrid
        isLoading={false}
        urls={["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"]}
        fallbackPhotos={null}
        photoAltPrefix="Foto do orçamento"
      />,
    );

    expect(screen.getByAltText("Foto do orçamento 1")).toHaveAttribute(
      "src",
      "https://cdn.example/1.jpg",
    );
    expect(screen.getByAltText("Foto do orçamento 2")).toBeInTheDocument();
  });
});
