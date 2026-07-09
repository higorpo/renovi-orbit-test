import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderKycGate } from "../ProviderKycGate";

const mockUseAuth = vi.fn();
const mockUseProviderPaymentAccount = vi.fn();
const mockUseRetryKycEmailDispatch = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../hooks/useProviderPaymentAccount", () => ({
  useProviderPaymentAccount: (...args: unknown[]) => mockUseProviderPaymentAccount(...args),
}));

vi.mock("../../hooks/useRetryKycEmailDispatch", () => ({
  useRetryKycEmailDispatch: (...args: unknown[]) => mockUseRetryKycEmailDispatch(...args),
}));

vi.mock("../ProviderKycForm", () => ({
  ProviderKycForm: () => <div data-testid="provider-kyc-form">KYC Form</div>,
}));

const mockShouldBlock = vi.fn(
  (account: { onboardingStatus?: string } | null) =>
    !account
    || account.onboardingStatus === "PENDING_DOCUMENTS"
    || account.onboardingStatus === "DOCUMENTS_SUBMITTED",
);

vi.mock("../../api/kyc.api", () => ({
  shouldBlockProviderForKyc: (...args: unknown[]) => mockShouldBlock(...args),
  isProviderKycPending: (account: { onboardingStatus?: string } | null) =>
    account?.onboardingStatus === "PENDING_DOCUMENTS",
  isProviderKycSubmitting: (account: { onboardingStatus?: string; emailDispatchedAt?: string | null } | null) =>
    Boolean(account?.onboardingStatus === "DOCUMENTS_SUBMITTED" && !account.emailDispatchedAt),
}));

describe("ProviderKycGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldBlock.mockImplementation(
      (account: { onboardingStatus?: string } | null) =>
        !account
        || account.onboardingStatus === "PENDING_DOCUMENTS"
        || account.onboardingStatus === "DOCUMENTS_SUBMITTED",
    );
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

  it("shows KYC form when documents are pending", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "PENDING_DOCUMENTS",
        emailDispatchedAt: null,
        onboardingSubmittedAt: null,
      },
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

  it("shows submitting state while email dispatch is pending", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        emailDispatchedAt: null,
        onboardingSubmittedAt: "2026-07-01T00:00:00.000Z",
      },
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

  it("passes children when KYC is not blocking", () => {
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "ACTIVE",
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
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

  it("passes children when blocked status already has email dispatched", () => {
    mockShouldBlock.mockReturnValue(true);
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "UNDER_REVIEW",
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <ProviderKycGate>
        <div>App content</div>
      </ProviderKycGate>,
    );

    // Blocked but neither pending nor submitting → fallthrough children.
    expect(screen.getByText("App content")).toBeInTheDocument();
  });
});
