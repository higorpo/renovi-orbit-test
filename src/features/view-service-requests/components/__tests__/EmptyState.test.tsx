import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title and support text", () => {
    render(
      <MemoryRouter>
        <EmptyState />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", {
        name: /Você ainda não solicitou nenhum serviço/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Crie seu primeiro serviço para começar a receber propostas/i)
    ).toBeInTheDocument();
  });

  it("renders CTA link to request quote", () => {
    render(
      <MemoryRouter>
        <EmptyState />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /Solicitar serviço/i });
    expect(link).toHaveAttribute("href", "/pedir-orcamento");
  });
});
