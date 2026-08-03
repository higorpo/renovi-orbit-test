// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderKycBlocksNav } from "../useProviderKycBlocksNav";

const mockUseAuth = vi.fn();
const mockUseProviderPaymentAccount = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../useProviderPaymentAccount", () => ({
  useProviderPaymentAccount: (...args: unknown[]) => mockUseProviderPaymentAccount(...args),
}));

describe("useProviderKycBlocksNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not block clients", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "client" } });
    mockUseProviderPaymentAccount.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useProviderKycBlocksNav());

    expect(result.current).toBe(false);
    expect(mockUseProviderPaymentAccount).toHaveBeenCalledWith(false);
  });

  it("does not block ACTIVE providers", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "provider" } });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "ACTIVE",
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useProviderKycBlocksNav());

    expect(result.current).toBe(false);
  });

  it("blocks when provider KYC is incomplete", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "provider" } });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: {
        id: "acc-1",
        onboardingStatus: "PENDING_DOCUMENTS",
        emailDispatchedAt: null,
        onboardingSubmittedAt: null,
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useProviderKycBlocksNav());

    expect(result.current).toBe(true);
  });

  it("blocks while provider account is loading", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "provider" } });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useProviderKycBlocksNav());

    expect(result.current).toBe(true);
  });
});
