// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderPayoutMethods } from "../useProviderPayoutMethods";

const mocks = vi.hoisted(() => ({
  useProviderProfile: vi.fn(),
  useBrazilianBanks: vi.fn(),
}));

vi.mock("../useProviderProfile", () => ({
  useProviderProfile: () => mocks.useProviderProfile(),
}));

vi.mock("@/features/provider-kyc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/provider-kyc")>();
  return {
    ...actual,
    useBrazilianBanks: () => mocks.useBrazilianBanks(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useProviderPayoutMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useBrazilianBanks.mockReturnValue({
      data: [{ code: "001", name: "Banco do Brasil" }],
      isLoading: false,
    });
  });

  it("maps private bank fields and resolves the institution label", async () => {
    mocks.useProviderProfile.mockReturnValue({
      privateData: {
        bank_institution_code: "001",
        bank_branch: "1234",
        bank_account: "56789-0",
        pix_key: "joao@prestway.com",
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useProviderPayoutMethods(), { wrapper });

    await waitFor(() => {
      expect(result.current.bankLabel).toBe("Banco do Brasil (001)");
    });
    expect(result.current.bankBranch).toBe("1234");
    expect(result.current.bankAccount).toBe("56789-0");
    expect(result.current.pixKey).toBe("joao@prestway.com");
    expect(result.current.hasBankDetails).toBe(true);
  });

  it("resolves an unpadded COMPE code the same way onboarding does", () => {
    mocks.useBrazilianBanks.mockReturnValue({
      data: [{ code: "084", name: "Sisprime do Brasil" }],
      isLoading: false,
    });
    mocks.useProviderProfile.mockReturnValue({
      privateData: {
        bank_institution_code: "84",
        bank_branch: "1234",
        bank_account: "56789-0",
        pix_key: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useProviderPayoutMethods(), { wrapper });

    expect(result.current.bankLabel).toBe("Sisprime do Brasil (084)");
  });

  it("falls back to the raw code when the bank list has no match", () => {
    mocks.useBrazilianBanks.mockReturnValue({ data: [], isLoading: false });
    mocks.useProviderProfile.mockReturnValue({
      privateData: {
        bank_institution_code: "999",
        bank_branch: "1",
        bank_account: "2",
        pix_key: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useProviderPayoutMethods(), { wrapper });

    expect(result.current.bankLabel).toBe("999");
    expect(result.current.pixKey).toBeNull();
    expect(result.current.hasBankDetails).toBe(true);
  });

  it("reports missing bank details", () => {
    mocks.useProviderProfile.mockReturnValue({
      privateData: {
        bank_institution_code: null,
        bank_branch: null,
        bank_account: null,
        pix_key: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useProviderPayoutMethods(), { wrapper });

    expect(result.current.hasBankDetails).toBe(false);
    expect(result.current.bankLabel).toBeNull();
  });
});
