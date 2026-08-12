import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalDocumentsSection } from "../LegalDocumentsSection";

const TERMS_URL = "https://example.com/juridico/termos-de-uso";
const PRIVACY_URL = "https://example.com/juridico/politica-de-privacidade";
const CONTRACT_URL = "https://example.com/juridico/adesao-prestador";

describe("LegalDocumentsSection", () => {
  it("renders terms and privacy links for clients without the provider contract", () => {
    render(
      <LegalDocumentsSection termsOfUseUrl={TERMS_URL} privacyPolicyUrl={PRIVACY_URL} />,
    );

    expect(screen.getByLabelText("Documentos jurídicos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Termos de uso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Política de privacidade" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Contrato de uso da plataforma" }),
    ).not.toBeInTheDocument();

    const terms = screen.getByRole("link", { name: "Ver termos de uso" });
    expect(terms).toHaveAttribute("href", TERMS_URL);
    expect(terms).toHaveAttribute("target", "_blank");
    expect(terms).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("link", { name: "Ver política de privacidade" })).toHaveAttribute(
      "href",
      PRIVACY_URL,
    );
  });

  it("renders the provider platform contract when showProviderContract is true", () => {
    render(
      <LegalDocumentsSection
        termsOfUseUrl={TERMS_URL}
        privacyPolicyUrl={PRIVACY_URL}
        providerPlatformContractUrl={CONTRACT_URL}
        showProviderContract
      />,
    );

    const contract = screen.getByRole("link", { name: "Ver contrato de uso da plataforma" });
    expect(contract).toHaveAttribute("href", CONTRACT_URL);
    expect(contract).toHaveAttribute("target", "_blank");
  });

  it("renders upcoming-document copy when URLs are missing", () => {
    render(<LegalDocumentsSection termsOfUseUrl={null} privacyPolicyUrl={null} />);

    expect(screen.getByText("Termos de uso em breve.")).toBeInTheDocument();
    expect(screen.getByText("Política de privacidade em breve.")).toBeInTheDocument();
  });

  it("renders upcoming-contract copy when the provider URL is missing", () => {
    render(
      <LegalDocumentsSection
        showProviderContract
        providerPlatformContractUrl={null}
      />,
    );

    expect(screen.getByText("Contrato de uso da plataforma em breve.")).toBeInTheDocument();
  });
});
