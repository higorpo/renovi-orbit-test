import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("PaymentTrustDisclosure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders trust copy and terms link", async () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "https://renovi.com.br/");
    const { PaymentTrustDisclosure } = await import("../PaymentTrustDisclosure");
    render(<PaymentTrustDisclosure />);

    expect(
      screen.getByRole("region", { name: /Informações sobre pagamento seguro/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/parceiro certificado/i)).toBeInTheDocument();

    const termsLink = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termsLink).toHaveAttribute("href", "https://renovi.com.br/juridico/termos-de-uso");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("builds a relative terms URL when the main site env is empty", async () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", "");
    const { PaymentTrustDisclosure } = await import("../PaymentTrustDisclosure");
    render(<PaymentTrustDisclosure />);

    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute(
      "href",
      "/juridico/termos-de-uso",
    );
  });

  it("falls back when the main site env is undefined", async () => {
    vi.stubEnv("VITE_MAIN_SITE_URL", undefined as unknown as string);
    const { PaymentTrustDisclosure } = await import("../PaymentTrustDisclosure");
    render(<PaymentTrustDisclosure />);

    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute(
      "href",
      "/juridico/termos-de-uso",
    );
  });
});
