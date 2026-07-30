// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderKycNavItems } from "../useProviderKycNavItems";

const mockUseAuth = vi.fn();
const mockUseProviderPaymentAccount = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../useProviderPaymentAccount", () => ({
  useProviderPaymentAccount: (...args: unknown[]) => mockUseProviderPaymentAccount(...args),
}));

const allItems = [
  { path: "/dashboard", label: "Visão geral" },
  { path: "/dashboard/jobs", label: "Trabalhos" },
  { path: "/dashboard/conta", label: "Minha conta" },
  { path: "/dashboard/help", label: "Ajuda" },
];
const mainItems = allItems.slice(0, 3);

describe("useProviderKycNavItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps full menu for clients", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "client" } });
    mockUseProviderPaymentAccount.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useProviderKycNavItems(allItems, mainItems));

    expect(result.current.allItems).toEqual(allItems);
    expect(result.current.mainItems).toEqual(mainItems);
    expect(mockUseProviderPaymentAccount).toHaveBeenCalledWith(false);
  });

  it("keeps full menu for ACTIVE providers", () => {
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

    const { result } = renderHook(() => useProviderKycNavItems(allItems, mainItems));

    expect(result.current.allItems).toHaveLength(4);
    expect(result.current.mainItems).toEqual(mainItems);
  });

  it("limits menu to Minha conta when provider is blocked", () => {
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

    const { result } = renderHook(() => useProviderKycNavItems(allItems, mainItems));

    expect(result.current.allItems).toEqual([{ path: "/dashboard/conta", label: "Minha conta" }]);
    expect(result.current.mainItems).toEqual([{ path: "/dashboard/conta", label: "Minha conta" }]);
  });

  it("limits menu while provider account is loading", () => {
    mockUseAuth.mockReturnValue({ profile: { role: "provider" } });
    mockUseProviderPaymentAccount.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useProviderKycNavItems(allItems, mainItems));

    expect(result.current.allItems).toEqual([{ path: "/dashboard/conta", label: "Minha conta" }]);
  });
});
