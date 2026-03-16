import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useAddressesList } from "../useAddressesList";
import * as addressesApi from "../../api/addresses.api";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/addresses.api", () => ({
  listAddresses: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const listAddresses = vi.mocked(addressesApi.listAddresses);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAddressesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    listAddresses.mockResolvedValue({ addresses: [], error: null });
  });

  it("returns addresses, error, isLoading and refetch", async () => {
    const addresses = [
      {
        id: "addr-1",
        client_id: "user-1",
        street: "Rua A",
        number: "1",
        neighborhood: "Centro",
        platform_cities: { name: "São Paulo" },
        platform_states: { abbreviation: "SP" },
      },
    ];
    listAddresses.mockResolvedValue({ addresses: addresses as never, error: null });

    const { result } = renderHook(() => useAddressesList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.addresses).toEqual(addresses);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
    expect(listAddresses).toHaveBeenCalledWith("user-1");
  });

  it("does not fetch when user is null", async () => {
    useAuth.mockReturnValue({
      user: null,
      profile: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAddressesList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listAddresses).not.toHaveBeenCalled();
    expect(result.current.addresses).toEqual([]);
  });

  it("returns error when listAddresses returns error", async () => {
    listAddresses.mockResolvedValue({ addresses: [], error: "DB error" });

    const { result } = renderHook(() => useAddressesList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("DB error");
    expect(result.current.addresses).toEqual([]);
  });
});
