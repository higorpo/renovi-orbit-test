import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KycDocumentsSection } from "../KycDocumentsSection";

const pfDocuments = [
  {
    key: "identity" as const,
    label: "Documento de identidade (CPF/CNH)",
    helper: "Comprova sua identidade para uso da plataforma.",
    storagePath: "providers/p1/kyc/identity/document.pdf",
    fileName: "document.pdf",
  },
  {
    key: "address-proof" as const,
    label: "Comprovante de endereço",
    helper: "Conta de luz, água ou extrato recente em seu nome.",
    storagePath: null,
    fileName: null,
  },
];

describe("KycDocumentsSection", () => {
  it("lists onboarding documents and lets the provider download sent files", () => {
    const onDownload = vi.fn();

    render(
      <KycDocumentsSection
        documents={pfDocuments}
        downloadingKey={null}
        onDownload={onDownload}
        supportHref="mailto:contato@prestway.com"
      />,
    );

    expect(screen.getByText("Documento de identidade (CPF/CNH)")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText("Não enviado")).toBeInTheDocument();
    expect(screen.getByText(/não podem ser alterados por aqui/i)).toBeInTheDocument();

    const support = screen.getByRole("link", { name: /Falar com o suporte/i });
    expect(support).toHaveAttribute("href", "mailto:contato@prestway.com");

    fireEvent.click(screen.getByRole("button", { name: "Baixar Documento de identidade (CPF/CNH)" }));
    expect(onDownload).toHaveBeenCalledWith("identity");
    expect(screen.queryByRole("button", { name: /Baixar Comprovante de endereço/i })).not.toBeInTheDocument();
  });
});
