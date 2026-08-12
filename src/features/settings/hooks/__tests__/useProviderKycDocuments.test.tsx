// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderKycDocuments } from "../useProviderKycDocuments";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({
  useProviderProfile: vi.fn(),
  getKycDocumentSignedUrl: vi.fn(),
}));

vi.mock("../useProviderProfile", () => ({
  useProviderProfile: () => mocks.useProviderProfile(),
}));

vi.mock("@/features/provider-kyc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/provider-kyc")>();
  return {
    ...actual,
    getKycDocumentSignedUrl: (...args: unknown[]) =>
      mocks.getKycDocumentSignedUrl(...args),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useProviderKycDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useProviderProfile.mockReturnValue({
      privateData: {
        entity_type: "pf",
        identity_doc_storage_path: "providers/p1/kyc/identity/document.pdf",
        address_proof_storage_path: "providers/p1/kyc/address-proof/document.pdf",
        corporate_charter_storage_path: null,
        legal_rep_doc_storage_path: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("maps private KYC paths into the PF onboarding slots", () => {
    const { result } = renderHook(() => useProviderKycDocuments(), { wrapper });

    expect(result.current.documents.map((doc) => doc.key)).toEqual([
      "identity",
      "address-proof",
    ]);
    expect(result.current.documents[0]?.storagePath).toBe(
      "providers/p1/kyc/identity/document.pdf",
    );
  });

  it("opens a signed URL when downloading a sent document", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.getKycDocumentSignedUrl.mockResolvedValue({
      signedUrl: "https://signed.example/id.pdf",
      error: null,
    });

    const { result } = renderHook(() => useProviderKycDocuments(), { wrapper });

    await act(async () => {
      await result.current.downloadDocument("identity");
    });

    expect(mocks.getKycDocumentSignedUrl).toHaveBeenCalledWith(
      "providers/p1/kyc/identity/document.pdf",
    );
    expect(open).toHaveBeenCalledWith(
      "https://signed.example/id.pdf",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("toasts when the signed URL cannot be created", async () => {
    mocks.getKycDocumentSignedUrl.mockResolvedValue({
      signedUrl: null,
      error: "denied",
    });

    const { result } = renderHook(() => useProviderKycDocuments(), { wrapper });

    await act(async () => {
      await result.current.downloadDocument("identity");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível baixar o documento. Tente novamente.",
      );
    });
  });
});
