// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ClientMyServicesHeader } from "../ClientMyServicesHeader";
import { ProviderMyServicesHeader } from "../../provider/ProviderMyServicesHeader";

describe("my-services headers", () => {
  it("links clients to request a new service", () => {
    render(
      <MemoryRouter>
        <ClientMyServicesHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Meus serviços" })).toBeTruthy();
    expect(
      screen.getByText("Acompanhe e gerencie os serviços que você solicitou"),
    ).toBeTruthy();

    const links = screen.getAllByRole("link", { name: /Novo serviço/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "/pedir-orcamento");
  });

  it("renders provider page title and subtitle", () => {
    render(<ProviderMyServicesHeader />);

    expect(screen.getByRole("heading", { name: "Meus serviços" })).toBeTruthy();
    expect(
      screen.getByText("Acompanhe propostas enviadas e serviços em andamento"),
    ).toBeTruthy();
  });
});
