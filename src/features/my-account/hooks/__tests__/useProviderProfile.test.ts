import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useProviderProfile } from "../useProviderProfile";
import type {
  ProviderPrivateProfile,
  ProviderPublicProfileWithServiceArea,
} from "../../api/providerProfile.api";

const mockProfile = {
  id: "prov-1",
  role: "provider" as const,
  full_name: "Provider Name",
  phone: null,
  cpf: null,
  created_at: "2024-01-15T00:00:00Z",
};

const mockPrivateData: ProviderPrivateProfile = {
  provider_id: "prov-1",
  entity_type: "pf",
  cnpj: null,
  commercial_contact: null,
  cpf: null,
  legal_representative_cpf: null,
  legal_representative_name: null,
  nome_fantasia: null,
  razao_social: null,
  updated_at: "2024-01-01T00:00:00Z",
};

const mockPublicData: ProviderPublicProfileWithServiceArea = {
  provider_id: "prov-1",
  slug: "provider-name",
  display_name: null,
  bio: null,
  profile_visibility: "restricted",
  updated_at: "2024-01-01T00:00:00Z",
  service_area_neighborhood_ids: [],
  service_area_city: null,
  service_area_regions: null,
  service_area_neighborhoods: null,
};

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../useAccountProfile", () => ({
  useAccountProfile: vi.fn(),
}));

vi.mock("../../api/providerProfile.api", () => ({
  getProviderPrivateProfile: vi.fn(),
  getProviderPublicProfile: vi.fn(),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const useAccountProfile = vi.mocked(
  await import("../useAccountProfile").then((m) => m.useAccountProfile)
);
const getProviderPrivateProfile = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.getProviderPrivateProfile)
);
const getProviderPublicProfile = vi.mocked(
  await import("../../api/providerProfile.api").then((m) => m.getProviderPublicProfile)
);
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useProviderProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "prov-1", email: "p@e.com" },
      profile: mockProfile,
    } as unknown as ReturnType<typeof useAuth>);
    useAccountProfile.mockReturnValue({
      profile: mockProfile,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAccountProfile>);
    getProviderPrivateProfile.mockResolvedValue({
      data: mockPrivateData,
      error: null,
    });
    getProviderPublicProfile.mockResolvedValue({
      data: mockPublicData,
      error: null,
    });
  });

  it("returns composed profile, privateData, publicData and refetch when provider", async () => {
    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.privateData).toEqual(mockPrivateData);
    expect(result.current.publicData).toEqual(mockPublicData);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
    expect(getProviderPrivateProfile).toHaveBeenCalledWith("prov-1");
    expect(getProviderPublicProfile).toHaveBeenCalledWith("prov-1");
  });

  it("does not fetch when user is not provider", async () => {
    useAuth.mockReturnValue({
      user: { id: "u1", email: "u@e.com" },
      profile: { ...mockProfile, role: "client" as const },
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getProviderPrivateProfile).not.toHaveBeenCalled();
    expect(getProviderPublicProfile).not.toHaveBeenCalled();
    expect(result.current.privateData).toBeNull();
    expect(result.current.publicData).toBeNull();
  });

  it("returns null publicData when getProviderPublicProfile returns null and no error", async () => {
    getProviderPublicProfile.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.publicData).toBeNull();
  });

  it("returns error from private or public query data", async () => {
    getProviderPrivateProfile.mockResolvedValue({
      data: null,
      error: "Private fetch failed",
    });

    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Private fetch failed");
  });

  it("returns error from public query when public fetch returns error", async () => {
    getProviderPrivateProfile.mockResolvedValue({ data: mockPrivateData, error: null });
    getProviderPublicProfile.mockResolvedValue({
      data: null,
      error: "Public fetch failed",
    });

    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Public fetch failed");
  });

  it("refetch calls accountProfile and both provider API refetches", async () => {
    const accountRefetch = vi.fn();
    useAccountProfile.mockReturnValue({
      profile: mockProfile,
      isLoading: false,
      error: null,
      refetch: accountRefetch,
    } as ReturnType<typeof useAccountProfile>);

    const { result } = renderHook(() => useProviderProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.refetch();

    await waitFor(() => {
      expect(accountRefetch).toHaveBeenCalled();
    });
  });
});
