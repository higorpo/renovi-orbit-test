// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useClientPrivateProfile } from "../useClientPrivateProfile";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/clientProfilePrivate.api", () => ({
  getClientPrivateProfile: vi.fn(),
  updateClientPrivateProfile: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const getClientPrivateProfile = vi.mocked(
  await import("../../api/clientProfilePrivate.api").then(
    (m) => m.getClientPrivateProfile
  )
);
const updateClientPrivateProfile = vi.mocked(
  await import("../../api/clientProfilePrivate.api").then(
    (m) => m.updateClientPrivateProfile
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

describe("useClientPrivateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "client-1", email: "c@e.com" },
      profile: { id: "client-1", role: "client" },
    } as ReturnType<typeof useAuth>);
    getClientPrivateProfile.mockResolvedValue({
      data: {
        client_id: "client-1",
        cpf: "529.982.247-25",
        updated_at: "2024-01-01T00:00:00Z",
      },
      error: null,
    });
    updateClientPrivateProfile.mockResolvedValue({ error: null });
  });

  it("returns cpf, data, refetch and updateCpfAsync", async () => {
    const { result } = renderHook(() => useClientPrivateProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cpf).toBe("529.982.247-25");
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.client_id).toBe("client-1");
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
    expect(typeof result.current.updateCpfAsync).toBe("function");
    expect(result.current.isUpdating).toBe(false);
    expect(getClientPrivateProfile).toHaveBeenCalledWith("client-1");
  });

  it("does not fetch when user is not client", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1", email: "u@e.com" },
      profile: { id: "u1", role: "provider" },
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useClientPrivateProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getClientPrivateProfile).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.cpf).toBeNull();
  });

  it("updateCpfAsync calls updateClientPrivateProfile", async () => {
    const { result } = renderHook(() => useClientPrivateProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.updateCpfAsync({ cpf: "504.432.630-51" });

    expect(updateClientPrivateProfile).toHaveBeenCalledWith("client-1", {
      cpf: "504.432.630-51",
    });
  });

  it("returns error from getClientPrivateProfile", async () => {
    getClientPrivateProfile.mockResolvedValue({
      data: null,
      error: "Fetch failed",
    });

    const { result } = renderHook(() => useClientPrivateProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Fetch failed");
    expect(result.current.cpf).toBeNull();
  });
});
