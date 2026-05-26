// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useUpdateProviderProfile } from "../useUpdateProviderProfile";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/providerProfile.api", () => ({
  updateProviderPrivateProfile: vi.fn(),
  updateProviderPublicProfile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const updateProviderPrivateProfile = vi.mocked(
  await import("../../api/providerProfile.api").then(
    (m) => m.updateProviderPrivateProfile
  )
);
const updateProviderPublicProfile = vi.mocked(
  await import("../../api/providerProfile.api").then(
    (m) => m.updateProviderPublicProfile
  )
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useUpdateProviderProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      profile: { id: "prov-1", role: "provider" },
    } as ReturnType<typeof useAuth>);
    updateProviderPrivateProfile.mockResolvedValue({ error: null });
    updateProviderPublicProfile.mockResolvedValue({ error: null });
  });

  it("exposes updatePrivateAsync and updatePublicAsync", () => {
    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.updatePrivateAsync).toBe("function");
    expect(typeof result.current.updatePublicAsync).toBe("function");
    expect(result.current.isUpdatingPrivate).toBe(false);
    expect(result.current.isUpdatingPublic).toBe(false);
  });

  it("updatePrivateAsync calls updateProviderPrivateProfile and returns", async () => {
    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    const promise = result.current.updatePrivateAsync({ entity_type: "pj" });

    await expect(promise).resolves.not.toThrow();
    expect(updateProviderPrivateProfile).toHaveBeenCalledWith("prov-1", {
      entity_type: "pj",
    });
  });

  it("updatePublicAsync calls updateProviderPublicProfile and returns", async () => {
    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    const promise = result.current.updatePublicAsync({
      display_name: "New Name",
      profile_visibility: "public",
    });

    await waitFor(() => {
      expect(updateProviderPublicProfile).toHaveBeenCalledWith("prov-1", {
        display_name: "New Name",
        profile_visibility: "public",
      });
    });

    await expect(promise).resolves.toEqual({ error: null });
  });

  it("isUpdatingPrivate is true while mutation is pending", async () => {
    let resolvePrivate: (v: { error: null }) => void;
    updateProviderPrivateProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePrivate = () => resolve({ error: null });
        })
    );

    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    const promise = result.current.updatePrivateAsync({ entity_type: "pf" });

    await waitFor(() => {
      expect(result.current.isUpdatingPrivate).toBe(true);
    });

    resolvePrivate!({ error: null });
    await promise;

    await waitFor(() => {
      expect(result.current.isUpdatingPrivate).toBe(false);
    });
  });

  it("shows toast on private update error", async () => {
    const { toast } = await import("sonner");
    updateProviderPrivateProfile.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.updatePrivateAsync({ entity_type: "pf" })
    ).rejects.toThrow("Network error");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível atualizar. Tente novamente."
      );
    });
  });

  it("shows toast on public update error", async () => {
    const { toast } = await import("sonner");
    updateProviderPublicProfile.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useUpdateProviderProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.updatePublicAsync({ display_name: "X" })
    ).rejects.toThrow("Server error");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível atualizar o perfil. Tente novamente."
      );
    });
  });
});
