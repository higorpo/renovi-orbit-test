// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as kycApi from "../../api/kyc.api";
import { useDispatchKyc } from "../useDispatchKyc";

const request = {
  entityType: "CPF" as const,
  fullName: "João Silva",
  document: "390.533.447-05",
  phone: "48999999999",
  email: "joao@example.com",
  bankInstitutionCode: "001",
  bankBranch: "1234",
  bankAccount: "56789-0",
  identityDocStoragePath: "path/id.pdf",
  addressProofStoragePath: "path/address.pdf",
  identityDocUrl: "https://example.com/id.pdf",
  addressProofUrl: "https://example.com/address.pdf",
};

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useDispatchKyc", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits KYC then dispatches email", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: {
        providerGatewayAccountId: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        dispatchKycEmailRequired: true,
      },
      error: null,
    });
    vi.spyOn(kycApi, "dispatchKycEmail").mockResolvedValue({
      data: {
        submissionId: "sub-1",
        emailDispatched: true,
      },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.submissionId).toBe("sub-1");
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("continues to email dispatch when submit returns INVALID_ONBOARDING_STATE", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: null,
      error: "already submitted",
      errorCode: "INVALID_ONBOARDING_STATE",
    });
    const dispatchSpy = vi.spyOn(kycApi, "dispatchKycEmail").mockResolvedValue({
      data: {
        submissionId: "sub-2",
        emailDispatched: true,
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(dispatchSpy).toHaveBeenCalled();
    expect(result.current.data?.submissionId).toBe("sub-2");
  });

  it("throws on hard submit failure", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: null,
      error: "hard fail",
      errorCode: "INVALID_BANK",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(request);
      }),
    ).rejects.toThrow("hard fail");
  });

  it("throws fallback when submit fails without a message", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: null,
      error: null,
      errorCode: "INVALID_BANK",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(request);
      }),
    ).rejects.toThrow("Falha ao salvar credenciamento");
  });

  it("throws when email dispatch fails", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: {
        providerGatewayAccountId: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        dispatchKycEmailRequired: true,
      },
      error: null,
    });
    vi.spyOn(kycApi, "dispatchKycEmail").mockResolvedValue({
      data: null,
      error: "email fail",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(request);
      }),
    ).rejects.toThrow("email fail");
  });

  it("throws fallback when email dispatch returns empty failure", async () => {
    vi.spyOn(kycApi, "submitProviderKyc").mockResolvedValue({
      data: {
        providerGatewayAccountId: "acc-1",
        onboardingStatus: "DOCUMENTS_SUBMITTED",
        dispatchKycEmailRequired: true,
      },
      error: null,
    });
    vi.spyOn(kycApi, "dispatchKycEmail").mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDispatchKyc(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(request);
      }),
    ).rejects.toThrow("Falha ao enviar credenciamento");
  });
});
