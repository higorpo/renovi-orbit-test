// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as clientCpfApi from "../../api/clientCpf.api";
import { useClientCpfForPayment } from "../useClientCpfForPayment";

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

describe("useClientCpfForPayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "client-1" },
      profile: { role: "client" },
    });
  });

  it("loads CPF for client users", async () => {
    vi.spyOn(clientCpfApi, "fetchClientCpf").mockResolvedValue({
      cpf: "39053344705",
      error: null,
    });

    const { result } = renderHook(() => useClientCpfForPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.cpf).toBe("39053344705");
    });
    expect(result.current.error).toBeNull();
  });

  it("stays idle for non-client users", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "provider-1" },
      profile: { role: "provider" },
    });
    const fetchSpy = vi.spyOn(clientCpfApi, "fetchClientCpf");

    const { result } = renderHook(() => useClientCpfForPayment(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("exposes API errors", async () => {
    vi.spyOn(clientCpfApi, "fetchClientCpf").mockResolvedValue({
      cpf: null,
      error: "db down",
    });

    const { result } = renderHook(() => useClientCpfForPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe("db down");
    });
  });
});
