import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderPayoutMethodsPage } from "../ProviderPayoutMethodsPage";

const mocks = vi.hoisted(() => ({
  payout: {
    bankLabel: "Nubank (260)",
    bankBranch: "0001",
    bankAccount: "12345-6",
    pixKey: "11999999999",
    hasBankDetails: true,
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

vi.mock("../../../hooks/useProviderPayoutMethods", () => ({
  useProviderPayoutMethods: () => mocks.payout,
}));

vi.mock("@/features/provider-kyc", () => ({
  PROVIDER_KYC_SUPPORT_URL: "https://prestway.test/suporte",
  PROVIDER_KYC_HELP_MAILTO: "mailto:contato@prestway.com",
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProviderPayoutMethodsPage />
    </MemoryRouter>,
  );
}

describe("ProviderPayoutMethodsPage", () => {
  beforeEach(() => {
    mocks.payout.isLoading = false;
    mocks.payout.error = null;
    mocks.payout.bankLabel = "Nubank (260)";
  });

  it("shows the payout account as a settings section", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Dados bancários" })).toBeInTheDocument();
    expect(screen.getByText(/deposita os seus ganhos/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Banco")).toHaveValue("Nubank (260)");
    expect(screen.getByRole("link", { name: /Falar com o suporte/i })).toHaveAttribute(
      "href",
      "https://prestway.test/suporte",
    );
  });
});
