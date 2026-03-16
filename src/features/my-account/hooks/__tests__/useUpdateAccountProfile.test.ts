import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useUpdateAccountProfile } from "../useUpdateAccountProfile";
import { toast } from "sonner";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
  profileApi: { updateProfile: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const profileApi = await import("@/features/auth").then((m) => m.profileApi);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useUpdateAccountProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    vi.mocked(profileApi.updateProfile).mockResolvedValue({ error: null });
  });

  it("returns updateProfile, updateProfileAsync and isUpdating", () => {
    const { result } = renderHook(() => useUpdateAccountProfile(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.updateProfile).toBe("function");
    expect(typeof result.current.updateProfileAsync).toBe("function");
    expect(result.current.isUpdating).toBe(false);
  });

  it("calls profileApi.updateProfile with user id and params", async () => {
    const { result } = renderHook(() => useUpdateAccountProfile(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateProfileAsync({
        full_name: "Novo Nome",
        phone: "48999999999",
        cpf: null,
      });
    });

    expect(profileApi.updateProfile).toHaveBeenCalledWith("user-1", {
      full_name: "Novo Nome",
      phone: "48999999999",
      cpf: null,
    });
    expect(toast.success).toHaveBeenCalledWith("Dados atualizados com sucesso.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not show success toast when updateProfile returns error", async () => {
    vi.mocked(profileApi.updateProfile).mockResolvedValue({ error: "DB error" });

    const { result } = renderHook(() => useUpdateAccountProfile(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateProfileAsync({ full_name: "Nome" });
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows error toast when mutation throws", async () => {
    vi.mocked(profileApi.updateProfile).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useUpdateAccountProfile(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.updateProfileAsync({ full_name: "Nome" });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível atualizar. Tente novamente.");
    });
  });

  it("throws when user is null", async () => {
    useAuth.mockReturnValue({
      user: null,
      profile: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useUpdateAccountProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.updateProfileAsync({ full_name: "Nome" })
    ).rejects.toThrow("Not authenticated");
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });
});
