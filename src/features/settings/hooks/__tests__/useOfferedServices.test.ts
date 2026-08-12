// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useOfferedServices } from "../useOfferedServices";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/providerProfile.api", () => ({
  listOfferedServices: vi.fn(),
  setOfferedServices: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const listOfferedServices = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.listOfferedServices)
);
const setOfferedServices = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.setOfferedServices)
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useOfferedServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      profile: { id: "prov-1", role: "provider" },
    } as ReturnType<typeof useAuth>);
    listOfferedServices.mockResolvedValue({
      serviceIds: ["s1", "s2"],
      error: null,
    });
    setOfferedServices.mockResolvedValue({ error: null });
  });

  it("returns serviceIds, refetch and setServiceIds", async () => {
    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.serviceIds).toEqual(["s1", "s2"]);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
    expect(typeof result.current.setServiceIds).toBe("function");
    expect(result.current.isUpdating).toBe(false);
    expect(listOfferedServices).toHaveBeenCalledWith("prov-1");
  });

  it("does not fetch when user is not provider", async () => {
    useAuth.mockReturnValue({
      profile: { id: "u1", role: "client" },
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listOfferedServices).not.toHaveBeenCalled();
    expect(result.current.serviceIds).toEqual([]);
  });

  it("setServiceIds calls setOfferedServices and invalidates query", async () => {
    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.serviceIds).toEqual(["s1", "s2"]);
    });

    await result.current.setServiceIds(["s1", "s3"]);

    expect(setOfferedServices).toHaveBeenCalledWith("prov-1", ["s1", "s3"]);
  });

  it("returns error from listOfferedServices", async () => {
    listOfferedServices.mockResolvedValue({
      serviceIds: [],
      error: "List failed",
    });

    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("List failed");
  });

  it("uses null providerId when profile has no id (nullish coalescing)", async () => {
    useAuth.mockReturnValue({
      profile: { role: "provider" },
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listOfferedServices).not.toHaveBeenCalled();
    expect(result.current.serviceIds).toEqual([]);
  });

  it("surfaces query error message when listOfferedServices rejects", async () => {
    listOfferedServices.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useOfferedServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("network down");
  });
});
