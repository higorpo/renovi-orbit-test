import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useProviderPublicProfile } from "../useProviderPublicProfile";

const getPublicProfileBySlugMock = vi.fn();

vi.mock("../../api/providerProfilePublic.api", () => ({
  getPublicProfileBySlug: (...args: unknown[]) =>
    getPublicProfileBySlugMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useProviderPublicProfile", () => {
  beforeEach(() => {
    getPublicProfileBySlugMock.mockReset();
  });

  it("does not fetch when slug is undefined", () => {
    renderHook(() => useProviderPublicProfile(undefined), {
      wrapper: createWrapper(),
    });
    expect(getPublicProfileBySlugMock).not.toHaveBeenCalled();
  });

  it("does not fetch when slug is empty", () => {
    renderHook(() => useProviderPublicProfile("  "), {
      wrapper: createWrapper(),
    });
    expect(getPublicProfileBySlugMock).not.toHaveBeenCalled();
  });

  it("fetches profile for valid slug", async () => {
    const payload = { data: { provider_id: "p1", slug: "joao" }, error: null };
    getPublicProfileBySlugMock.mockResolvedValue(payload);

    const { result } = renderHook(() => useProviderPublicProfile("joao"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPublicProfileBySlugMock).toHaveBeenCalledWith("joao");
    expect(result.current.data).toEqual(payload);
  });
});
