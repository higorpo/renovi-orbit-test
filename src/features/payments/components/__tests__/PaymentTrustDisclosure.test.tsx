import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentTrustDisclosure } from "../PaymentTrustDisclosure";

describe("PaymentTrustDisclosure", () => {
  it("renders trust copy and terms link", () => {
    render(<PaymentTrustDisclosure />);

    expect(
      screen.getByRole("region", { name: /Informações sobre pagamento seguro/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/parceiro certificado/i)).toBeInTheDocument();

    const termsLink = screen.getByRole("link", { name: /Termos de Uso/i });
    expect(termsLink).toHaveAttribute("href", expect.stringContaining("/juridico/termos-de-uso"));
    expect(termsLink).toHaveAttribute("target", "_blank");
  });
});
