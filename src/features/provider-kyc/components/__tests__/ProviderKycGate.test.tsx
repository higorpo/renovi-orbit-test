import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderKycGate } from "../ProviderKycGate";

const mockUseAuth = vi.fn();
const mockUseProviderPaymentAccount = vi.fn();
const mockUseRetryKycEmailDispatch = vi.fn();
const mockUseLocation = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  };
});

vi.mock("../../hooks/useProviderPaymentAccount", () => ({
  useProviderPaymentAccount: (...args: unknown[]) => mockUseProviderPaymentAccount(...args),
}));

vi.mock("../../hooks/useRetryKycEmailDispatch", () => ({
  useRetryKycEmailDispatch: (...args: unknown[]) => mockUseRetryKycEmailDispatch(...args),
}));

vi.mock("../ProviderKycForm", () => ({
  ProviderKycForm: ({ onSubmitted }: { onSubmitted?: () => void }) => (
    <div data-testid="provider-kyc-form">
      <button type="button" onClick={() => onSubmitted?.()}>
        submit-kyc
      </button>
    </div>
  ),
}));

vi.mock("../../api/kyc.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/kyc.api")>("../../api/kyc.api");
  return {
    isProviderCredentialed: actual.isProviderCredentialed,
    isProviderKycPending: actual.isProviderKycPending,
    isProviderKycSubmitting: actual.isProviderKycSubmitting,
    isProviderKycDocumentsSubmitted: actual.isProviderKycDocumentsSubmitted,
    isProviderKycAwaitingReview: actual.isProviderKycAwaitingReview,
    isProviderKycRejected: actual.isProviderKycRejected,
    isProviderKycSuspended: actual.isProviderKycSuspended,
  };
});

function account(
  onboardingStatus: string,
  overrides: Partial<{ emailDispatchedAt: string | null; onboardingSubmittedAt: string | null }> = {},
) {
  return {
    id: "acc-1",
    onboardingStatus,
    emailDispatchedAt: overrides.emailDispatchedAt ?? null,
    onboardingSubmittedAt: overrides.onboardingSubmittedAt ?? null,
  };
}

describe("ProviderKycGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: "/dashboard" });
    mockUseAuth.mockReturnValue({
      user: { id: "provider-1", email: "p@example.com" },
      profile: { role: "provider", phone: "48999999999" },
    });
  });

  it("passes children through for non-provider roles", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "client-1" },
      profile: { role: "client" },
    });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText("App content")).toBeInTheDocument();
  });

  it("shows loading state while account is fetching", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Verificando credenciamento/i)).toBeInTheDocument();
  });

  it("allows Minha conta route while KYC is blocking", () => {
    mockUseLocation.mockReturnValue({ pathname: "/dashboard/account" });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("PENDING_DOCUMENTS"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>Account content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText("Account content")).toBeInTheDocument();
    expect(screen.queryByTestId("provider-kyc-form")).not.toBeInTheDocument();
  });

  it("allows nested conta paths", () => {
    mockUseLocation.mockReturnValue({ pathname: "/dashboard/account/payments" });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("SUSPENDED"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>Nested account</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText("Nested account")).toBeInTheDocument();
  });

  it("passes children when onboarding is ACTIVE", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("ACTIVE", {
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText("App content")).toBeInTheDocument();
  });

  it("shows KYC form when documents are pending", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("PENDING_DOCUMENTS"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByTestId("provider-kyc-form")).toBeInTheDocument();
  });

  it("shows KYC form when provider has no payment account yet", () => {
    const refetch = vi.fn();
    mockUseProviderPaymentAccount.mockReturnValue({
      data: null,
      isLoading: false,
      refetch,
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByTestId("provider-kyc-form")).toBeInTheDocument();
    expect(mockUseProviderPaymentAccount).toHaveBeenCalledWith(true);
    expect(mockUseRetryKycEmailDispatch).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /submit-kyc/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows submitting state while email dispatch is pending", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("DOCUMENTS_SUBMITTED", {
        onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Enviando credenciamento/i)).toBeInTheDocument();
    expect(mockUseRetryKycEmailDispatch).toHaveBeenCalledWith(true);
  });

  it("shows documents-submitted status after email dispatch", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("DOCUMENTS_SUBMITTED", {
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Documentos enviados/i)).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
  });

  it("shows under-review status", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("UNDER_NETCRED_REVIEW", {
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Credenciamento em análise/i)).toBeInTheDocument();
  });

  it("shows rejected status and switches to form on resubmit", () => {
    const refetch = vi.fn();
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("REJECTED", {
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      }),
      isLoading: false,
      refetch,
    });
    mockUseAuth.mockReturnValue({
      user: { id: "provider-1", email: undefined },
      profile: { role: "provider", phone: null, full_name: null },
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Credenciamento não aprovado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reenviar documentos/i }));
    expect(screen.getByTestId("provider-kyc-form")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /submit-kyc/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows suspended status", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("SUSPENDED", {
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Conta suspensa/i)).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
  });

  it("shows generic blocked status for unknown non-active statuses", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: account("UNKNOWN_STATUS"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    expect(screen.getByText(/Credenciamento necessário/i)).toBeInTheDocument();
  });
});
