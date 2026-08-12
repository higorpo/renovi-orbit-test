// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useAccountProfile } from "../useAccountProfile";

const mockProfile = {
  id: "user-1",
  role: "client" as const,
  full_name: "Maria Silva",
  phone: null,
  cpf: null,
  created_at: "2024-01-15T00:00:00Z",
};

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
  getProfile: vi.fn(),
}));

const capturedQueryFns: Array<() => Promise<unknown>> = [];

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: Parameters<typeof actual.useQuery>[0]) => {
      if (typeof options.queryFn === "function") {
        capturedQueryFns.push(options.queryFn as () => Promise<unknown>);
      }
      return actual.useQuery(options);
    },
  };
});

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const getProfile = vi.mocked(await import("@/features/auth").then((m) => m.getProfile));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAccountProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueryFns.length = 0;
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "u@e.com" },
      profile: null,
    } as ReturnType<typeof useAuth>);
    getProfile.mockResolvedValue({ profile: mockProfile, error: null });
  });

  it("returns profile, error, isLoading and refetch", async () => {
    const { result } = renderHook(() => useAccountProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
  });

  it("does not fetch when user is null", async () => {
    useAuth.mockReturnValue({
      user: null,
      profile: null,
    } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAccountProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getProfile).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it("returns error when getProfile returns error", async () => {
    getProfile.mockResolvedValue({ profile: null, error: "Not found" });

    const { result } = renderHook(() => useAccountProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBe("Not found");
  });

  it("queryFn returns Not authenticated when user id is missing", async () => {
    useAuth.mockReturnValue({
      user: null,
      profile: null,
    } as ReturnType<typeof useAuth>);

    renderHook(() => useAccountProfile(), { wrapper: createWrapper() });
    expect(capturedQueryFns.length).toBeGreaterThan(0);

    getProfile.mockClear();
    const result = await capturedQueryFns[capturedQueryFns.length - 1]!();
    expect(result).toEqual({ profile: null, error: "Not authenticated" });
    expect(getProfile).not.toHaveBeenCalled();
  });
});
