import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { createElement } from "react";
import { MyAccountProviderPage } from "../MyAccountProviderPage";

vi.mock("nsfwjs", () => ({ load: vi.fn().mockResolvedValue({ classify: vi.fn() }) }));
vi.mock("@/features/request-quote/utils/photoContentCheck", () => ({
  checkPhotoContent: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/features/auth", () => ({ useAuth: vi.fn() }));
vi.mock("../../hooks/useAccountProfile", () => ({ useAccountProfile: vi.fn() }));
vi.mock("../../hooks/useProviderProfile", () => ({ useProviderProfile: vi.fn() }));
vi.mock("../../hooks/useUpdateAccountProfile", () => ({
  useUpdateAccountProfile: vi.fn(),
}));
vi.mock("../../hooks/useUpdateProviderProfile", () => ({
  useUpdateProviderProfile: vi.fn(),
}));
vi.mock("../../hooks/useProfilePhotoMutation", () => ({
  useUploadProfilePhoto: vi.fn(() => ({
    uploadPhotoAsync: vi.fn(),
    isUploading: false,
  })),
  useRemoveProfilePhoto: vi.fn(() => ({
    removePhotoAsync: vi.fn(),
    isRemoving: false,
  })),
}));
vi.mock("../../hooks/useOfferedServices", () => ({
  useOfferedServices: vi.fn(() => ({
    serviceIds: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    setServiceIds: vi.fn().mockResolvedValue(undefined),
    isUpdating: false,
  })),
}));
vi.mock("../../hooks/usePortfolioItems", () => ({
  usePortfolioItems: vi.fn(() => ({
    items: [],
    createItemWithImages: vi.fn().mockResolvedValue({ data: null, error: null }),
    updateItemWithImages: vi.fn().mockResolvedValue({ error: null }),
    deleteItem: vi.fn().mockResolvedValue({ error: null }),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  })),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const useProviderProfile = vi.mocked(
  await import("../../hooks/useProviderProfile").then((m) => m.useProviderProfile)
);
const useUpdateAccountProfile = vi.mocked(
  await import("../../hooks/useUpdateAccountProfile").then(
    (m) => m.useUpdateAccountProfile
  )
);
const useUpdateProviderProfile = vi.mocked(
  await import("../../hooks/useUpdateProviderProfile").then(
    (m) => m.useUpdateProviderProfile
  )
);
const useOfferedServices = vi.mocked(
  await import("../../hooks/useOfferedServices").then((m) => m.useOfferedServices)
);
const usePortfolioItems = vi.mocked(
  await import("../../hooks/usePortfolioItems").then((m) => m.usePortfolioItems)
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, {}, children)
    );
  };
}

describe("MyAccountProviderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "p1", email: "provider@example.com" },
    } as ReturnType<typeof useAuth>);
    useProviderProfile.mockReturnValue({
      profile: { id: "p1", role: "provider", full_name: "João" },
      privateData: {
        provider_id: "p1",
        entity_type: "pf",
        cnpj: null,
        commercial_contact: null,
        cpf: null,
        legal_representative_cpf: null,
        legal_representative_name: null,
        nome_fantasia: null,
        razao_social: null,
        updated_at: "2024-01-01T00:00:00Z",
      },
      publicData: {
        provider_id: "p1",
        slug: "joao",
        display_name: "João",
        profile_visibility: "restricted",
        bio: null,
        updated_at: "2024-01-01T00:00:00Z",
        service_area_neighborhood_ids: [],
        service_area_city: null,
        service_area_regions: null,
        service_area_neighborhoods: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProviderProfile>);
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);
    useOfferedServices.mockReturnValue({
      serviceIds: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setServiceIds: vi.fn().mockResolvedValue(undefined),
      isUpdating: false,
    } as ReturnType<typeof useOfferedServices>);
    usePortfolioItems.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createItem: vi.fn(),
      createItemWithImages: vi.fn().mockResolvedValue({ data: null, error: null }),
      updateItem: vi.fn(),
      updateItemWithImages: vi.fn().mockResolvedValue({ error: null }),
      deleteItem: vi.fn().mockResolvedValue({ error: null }),
      reorderItems: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as unknown as ReturnType<typeof usePortfolioItems>);
  });

  it("renders page title and subtitle", () => {
    render(<MyAccountProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Minha conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie seus dados, identidade profissional e perfil público/)
    ).toBeInTheDocument();
  });

  it("renders Tipo de entidade section", () => {
    render(<MyAccountProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Tipo de entidade")).toBeInTheDocument();
  });

  it("renders Serviços oferecidos and Perfil público sections", () => {
    render(<MyAccountProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Serviços oferecidos")).toBeInTheDocument();
    expect(screen.getByText("Perfil público")).toBeInTheDocument();
  });

  it("renders Portfólio and Zona de perigo", () => {
    render(<MyAccountProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Portfólio")).toBeInTheDocument();
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
  });
});
