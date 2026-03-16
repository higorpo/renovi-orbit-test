import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useSetDefaultAddress, useDeleteAddress } from "../useAddressMutations";
import * as addressesApi from "../../api/addresses.api";
import { toast } from "sonner";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/addresses.api", () => ({
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const updateAddress = vi.mocked(addressesApi.updateAddress);
const deleteAddress = vi.mocked(addressesApi.deleteAddress);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useSetDefaultAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    updateAddress.mockResolvedValue({ error: null });
  });

  it("returns setDefault, setDefaultAsync and isSettingDefault", () => {
    const { result } = renderHook(() => useSetDefaultAddress(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.setDefault).toBe("function");
    expect(typeof result.current.setDefaultAsync).toBe("function");
    expect(result.current.isSettingDefault).toBe(false);
  });

  it("calls updateAddress with is_default true and shows success toast", async () => {
    const { result } = renderHook(() => useSetDefaultAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.setDefaultAsync("addr-1");
    });

    expect(updateAddress).toHaveBeenCalledWith("addr-1", "user-1", { is_default: true });
    expect(toast.success).toHaveBeenCalledWith("Endereço padrão atualizado.");
  });

  it("shows error toast when updateAddress fails", async () => {
    updateAddress.mockResolvedValue({ error: "DB error" });

    const { result } = renderHook(() => useSetDefaultAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.setDefaultAsync("addr-1");
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível definir o endereço padrão.");
    });
  });
});

describe("useDeleteAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    deleteAddress.mockResolvedValue({ error: null });
  });

  it("returns deleteAddress, deleteAddressAsync and isDeleting", () => {
    const { result } = renderHook(() => useDeleteAddress(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.deleteAddress).toBe("function");
    expect(typeof result.current.deleteAddressAsync).toBe("function");
    expect(result.current.isDeleting).toBe(false);
  });

  it("calls deleteAddress API and shows success toast", async () => {
    const { result } = renderHook(() => useDeleteAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteAddressAsync("addr-1");
    });

    expect(deleteAddress).toHaveBeenCalledWith("addr-1", "user-1");
    expect(toast.success).toHaveBeenCalledWith("Endereço excluído.");
  });

  it("shows error toast when deleteAddress fails", async () => {
    deleteAddress.mockResolvedValue({ error: "DB error" });

    const { result } = renderHook(() => useDeleteAddress(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.deleteAddressAsync("addr-1");
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível excluir o endereço.");
    });
  });
});
