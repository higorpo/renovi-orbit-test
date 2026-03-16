import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MeusServicosHeader } from "../MeusServicosHeader";

describe("MeusServicosHeader", () => {
  it("renders page title and subtitle", () => {
    render(
      <MemoryRouter>
        <MeusServicosHeader />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /Meus Serviços/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhe e gerencie os serviços que você solicitou/i)
    ).toBeInTheDocument();
  });

  it("renders CTA link(s) to request quote (header on desktop, FAB on mobile)", () => {
    render(
      <MemoryRouter>
        <MeusServicosHeader />
      </MemoryRouter>
    );
    const links = screen.getAllByRole("link", { name: /Novo serviço/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/pedir-orcamento");
    });
  });
});
