import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrivacySection } from "../PrivacySection";

describe("PrivacySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and DPO link", () => {
    render(<PrivacySection />);
    expect(
      screen.getByText("Privacidade e LGPD")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Falar com o DPO/ }).getAttribute("href")).toContain("mailto:");
  });

  it("opens export info dialog when Exportar meus dados is clicked", () => {
    render(<PrivacySection />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    expect(
      screen.getByRole("heading", { name: /Exportar meus dados/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/portabilidade/)
    ).toBeInTheDocument();
  });

  it("closes export dialog when Entendi is clicked", () => {
    render(<PrivacySection />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar meus dados/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Entendi$/ }));
    expect(
      screen.queryByRole("heading", { name: /Exportar meus dados/ })
    ).not.toBeInTheDocument();
  });

  it("renders Ver política de privacidade link when privacyPolicyUrl is set", () => {
    render(
      <PrivacySection privacyPolicyUrl="https://example.com/privacy" />
    );
    const link = screen.getByRole("link", { name: /Ver política de privacidade/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("https://example.com/privacy");
  });

  it("renders Política de privacidade em breve when privacyPolicyUrl is null", () => {
    render(<PrivacySection privacyPolicyUrl={null} />);
    expect(screen.getByText("Política de privacidade em breve.")).toBeInTheDocument();
  });
});
