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

  it("renders Exportar meus dados button when onExportData provided", () => {
    const onExportData = vi.fn();
    render(<PrivacySection onExportData={onExportData} />);
    const btn = screen.getByRole("button", { name: /Exportar meus dados/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onExportData).toHaveBeenCalled();
  });

  it("shows Preparando… when isExporting is true", () => {
    render(
      <PrivacySection onExportData={vi.fn()} isExporting />
    );
    expect(screen.getByText("Preparando…")).toBeInTheDocument();
  });

  it("disables export button when isExporting", () => {
    render(
      <PrivacySection onExportData={vi.fn()} isExporting />
    );
    expect(screen.getByText("Preparando…")).toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: /Exportar meus dados/ });
    expect(exportButton).toBeDisabled();
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
