import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderKycDocumentsPage } from "../ProviderKycDocumentsPage";

const mocks = vi.hoisted(() => ({
  kycDocuments: {
    documents: [
      {
        key: "identity" as const,
        label: "Documento de identidade (CPF/CNH)",
        helper: "Comprova sua identidade para uso da plataforma.",
        storagePath: "providers/p1/kyc/identity/document.pdf",
        fileName: "document.pdf",
      },
    ],
    downloadingKey: null as string | null,
    downloadDocument: vi.fn(),
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    profile: { role: "provider" },
    loading: false,
  }),
}));

vi.mock("../../../hooks/useProviderKycDocuments", () => ({
  useProviderKycDocuments: () => mocks.kycDocuments,
}));

vi.mock("@/features/provider-kyc", () => ({
  PROVIDER_KYC_SUPPORT_URL: "https://prestway.test/suporte",
  PROVIDER_KYC_HELP_MAILTO: "mailto:contato@prestway.com",
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProviderKycDocumentsPage />
    </MemoryRouter>,
  );
}

describe("ProviderKycDocumentsPage", () => {
  beforeEach(() => {
    mocks.kycDocuments.isLoading = false;
    mocks.kycDocuments.error = null;
  });

  it("shows onboarding documents as a settings section", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.getByText(/enviados na verificação da conta/i)).toBeInTheDocument();
    expect(screen.getByText("Documento de identidade (CPF/CNH)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Falar com o suporte/i })).toHaveAttribute(
      "href",
      "https://prestway.test/suporte",
    );
  });
});
