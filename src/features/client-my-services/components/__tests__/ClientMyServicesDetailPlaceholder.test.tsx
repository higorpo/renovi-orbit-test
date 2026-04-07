import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ClientMyServicesDetailPlaceholder } from "../ClientMyServicesDetailPlaceholder";

describe("ClientMyServicesDetailPlaceholder", () => {
  it("renders back link and service id from route params", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/services/sr-abc"]}>
        <Routes>
          <Route path="/dashboard/services/:id" element={<ClientMyServicesDetailPlaceholder />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Detalhe do serviço/i })).toBeInTheDocument();
    expect(screen.getByText(/sr-abc/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar para Meus Serviços/i })).toHaveAttribute(
      "href",
      "/dashboard/requests"
    );
  });

  it("shows em dash when route has no id param", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <Routes>
          <Route path="/dashboard/services" element={<ClientMyServicesDetailPlaceholder />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/ID:\s*—/)).toBeInTheDocument();
  });
});
