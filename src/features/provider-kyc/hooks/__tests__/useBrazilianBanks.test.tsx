// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBrazilianBanks = vi.fn();

vi.mock("../../api/brazilianBanks.api", () => ({
  fetchBrazilianBanks: (...args: unknown[]) => fetchBrazilianBanks(...args),
}));

import { useBrazilianBanks } from "../useBrazilianBanks";

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

describe("useBrazilianBanks", () => {
  beforeEach(() => {
    fetchBrazilianBanks.mockReset();
  });

  it("loads banks from the API layer without shipping the fallback up front", async () => {
    const fromApi = [
      { code: "260", name: "Nubank" },
      { code: "001", name: "Banco do Brasil" },
    ];
    fetchBrazilianBanks.mockResolvedValue(fromApi);

    const { result } = renderHook(() => useBrazilianBanks(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(fromApi);
    });
  });
});
