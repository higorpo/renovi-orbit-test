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

  it("renders CTA link to request quote", () => {
    render(
      <MemoryRouter>
        <MeusServicosHeader />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /Novo serviço/i });
    expect(link).toHaveAttribute("href", "/pedir-orcamento");
  });
});
