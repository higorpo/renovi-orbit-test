// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceDetailSection } from "../ServiceDetailSection";

describe("ServiceDetailSection", () => {
  it("renders title, description, accessory, and children", () => {
    render(
      <ServiceDetailSection
        title="Seção"
        description="Detalhe"
        titleAccessory={<span>info</span>}
      >
        <p>Conteúdo</p>
      </ServiceDetailSection>,
    );

    expect(screen.getByRole("heading", { name: "Seção" })).toBeInTheDocument();
    expect(screen.getByText("Detalhe")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });

  it("renders children without a title", () => {
    render(
      <ServiceDetailSection>
        <p>Só conteúdo</p>
      </ServiceDetailSection>,
    );
    expect(screen.getByText("Só conteúdo")).toBeInTheDocument();
  });
});
