// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as kycApi from "../../api/kyc.api";
import { useProviderPaymentAccount } from "../useProviderPaymentAccount";

const mockUseAuth = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useProviderPaymentAccount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "provider-1" } });
  });

  it("loads provider payment account", async () => {
    vi.spyOn(kycApi, "fetchProviderPaymentAccount").mockResolvedValue({
      data: {
        id: "acc-1",
        onboardingStatus: "ACTIVE",
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderPaymentAccount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe("acc-1");
  });

  it("throws when fetch fails", async () => {
    vi.spyOn(kycApi, "fetchProviderPaymentAccount").mockResolvedValue({
      data: null,
      error: "account failed",
    });

    const { result } = renderHook(() => useProviderPaymentAccount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("polls while documents are submitted without email dispatch", async () => {
    vi.spyOn(kycApi, "fetchProviderPaymentAccount").mockResolvedValue({
      data: {
        id: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        emailDispatchedAt: null,
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderPaymentAccount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // refetchInterval callback is configured on the query options
    expect(result.current.data?.onboardingStatus).toBe("DOCUMENTS_SUBMITTED");
  });

  it("does not fetch without authenticated user", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const spy = vi.spyOn(kycApi, "fetchProviderPaymentAccount");
    renderHook(() => useProviderPaymentAccount(), { wrapper: createWrapper() });
    expect(spy).not.toHaveBeenCalled();
  });

  it("polls every 30s after email dispatch and during partner review", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    vi.spyOn(kycApi, "fetchProviderPaymentAccount").mockResolvedValue({
      data: {
        id: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        emailDispatchedAt: "2026-07-01T00:00:00.000Z",
        onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderPaymentAccount(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      queryKey: ["provider-payment-account", "provider-1"],
    });
    const refetchInterval = query?.options.refetchInterval;
    expect(typeof refetchInterval).toBe("function");

    const intervalFn = refetchInterval as (q: {
      state: { data: kycApi.ProviderPaymentAccount | null | undefined };
    }) => number | false;

    expect(
      intervalFn({
        state: {
          data: {
            id: "acc-1",
            onboardingStatus: "DOCUMENTS_SUBMITTED",
            emailDispatchedAt: "2026-07-01T00:00:00.000Z",
            onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
          },
        },
      }),
    ).toBe(30_000);

    expect(
      intervalFn({
        state: {
          data: {
            id: "acc-1",
            onboardingStatus: "UNDER_NETCRED_REVIEW",
            emailDispatchedAt: "2026-07-01T00:00:00.000Z",
            onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
          },
        },
      }),
    ).toBe(30_000);

    expect(
      intervalFn({
        state: {
          data: {
            id: "acc-1",
            onboardingStatus: "ACTIVE",
            emailDispatchedAt: "2026-07-01T00:00:00.000Z",
            onboardingSubmittedAt: "2026-06-30T00:00:00.000Z",
          },
        },
      }),
    ).toBe(false);

    expect(intervalFn({ state: { data: null } })).toBe(false);
  });
});
