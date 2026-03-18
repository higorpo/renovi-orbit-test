import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProviderProfileCtaBanner } from "../ProviderProfileCtaBanner";

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <ProviderProfileCtaBanner />
    </MemoryRouter>,
  );
}

describe("ProviderProfileCtaBanner", () => {
  it("renders heading copy", () => {
    renderWithRouter();
    expect(
      screen.getByRole("heading", {
        name: /precisa de um serviço para sua casa/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders descriptive text", () => {
    renderWithRouter();
    expect(
      screen.getByText(/profissionais qualificados/i),
    ).toBeInTheDocument();
  });

  it("renders CTA link to /pedir-orcamento", () => {
    renderWithRouter();
    const link = screen.getByRole("link", {
      name: /pedir orçamento grátis/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/pedir-orcamento");
  });
});
