import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DangerZoneSection } from "../DangerZoneSection";

describe("DangerZoneSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zone title and description", () => {
    render(<DangerZoneSection />);
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
    expect(
      screen.getByText(/Essa ação é irreversível/)
    ).toBeInTheDocument();
  });

  it("renders Excluir minha conta button", () => {
    render(<DangerZoneSection />);
    expect(
      screen.getByRole("button", { name: /Excluir minha conta/ })
    ).toBeInTheDocument();
  });

  it("opens delete info dialog when button is clicked", () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole("button", { name: /Excluir minha conta/ }));
    expect(
      screen.getByRole("heading", { name: /Excluir minha conta/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/encarregado de dados/)
    ).toBeInTheDocument();
  });

  it("closes dialog when Entendi is clicked", () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole("button", { name: /Excluir minha conta/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Entendi$/ }));
    expect(
      screen.queryByRole("heading", { name: /Excluir minha conta/ })
    ).not.toBeInTheDocument();
  });
});
