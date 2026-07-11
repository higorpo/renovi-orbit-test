// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ClientMyServicesEmptyState } from "../ClientMyServicesEmptyState";
import { ProviderMyServicesEmptyState } from "../../provider/ProviderMyServicesEmptyState";

describe("my-services empty states", () => {
  it("links clients to request a quote", () => {
    render(
      <MemoryRouter>
        <ClientMyServicesEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByText("Você ainda não solicitou nenhum serviço")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Solicitar serviço/i })).toHaveAttribute(
      "href",
      "/pedir-orcamento",
    );
  });

  it("links providers to the jobs feed", () => {
    render(
      <MemoryRouter>
        <ProviderMyServicesEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByText("Você ainda não enviou propostas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver trabalhos/i })).toHaveAttribute(
      "href",
      "/dashboard/jobs",
    );
  });
});
