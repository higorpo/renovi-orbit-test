import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { createElement } from "react";
import { MyAccountClientPage } from "../MyAccountClientPage";

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});
vi.mock("../../hooks/useAccountProfile", () => ({ useAccountProfile: vi.fn() }));
vi.mock("../../hooks/useClientPrivateProfile", () => ({
  useClientPrivateProfile: vi.fn(),
}));
vi.mock("../../hooks/useUpdateAccountProfile", () => ({
  useUpdateAccountProfile: vi.fn(),
}));
vi.mock("../../hooks/useProfilePhotoMutation", () => ({
  useUploadProfilePhoto: vi.fn(),
  useRemoveProfilePhoto: vi.fn(),
}));
vi.mock("@/features/addresses", () => ({
  AddressesSection: () => <div data-testid="addresses-section">Endereços</div>,
}));
vi.mock("@/features/payments", () => ({
  SavedCardsList: () => <div data-testid="saved-cards-section">Cartões</div>,
  PaymentHistorySection: () => <div data-testid="payment-history-section">Pagamentos</div>,
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const useAccountProfile = vi.mocked(
  await import("../../hooks/useAccountProfile").then((m) => m.useAccountProfile)
);
const useClientPrivateProfile = vi.mocked(
  await import("../../hooks/useClientPrivateProfile").then(
    (m) => m.useClientPrivateProfile
  )
);
const useUpdateAccountProfile = vi.mocked(
  await import("../../hooks/useUpdateAccountProfile").then(
    (m) => m.useUpdateAccountProfile
  )
);
const useUploadProfilePhoto = vi.mocked(
  await import("../../hooks/useProfilePhotoMutation").then(
    (m) => m.useUploadProfilePhoto
  )
);
const useRemoveProfilePhoto = vi.mocked(
  await import("../../hooks/useProfilePhotoMutation").then(
    (m) => m.useRemoveProfilePhoto
  )
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

describe("MyAccountClientPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "u1", email: "user@example.com" },
    } as ReturnType<typeof useAuth>);
    useAccountProfile.mockReturnValue({
      profile: {
        id: "u1",
        role: "client",
        full_name: "Maria Silva",
        phone: null,
        cpf: null,
        created_at: "2024-01-15T00:00:00Z",
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAccountProfile>);
    useClientPrivateProfile.mockReturnValue({
      cpf: null,
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateCpfAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: false,
    } as ReturnType<typeof useClientPrivateProfile>);
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);
    useUploadProfilePhoto.mockReturnValue({
      uploadPhoto: vi.fn(),
      uploadPhotoAsync: vi.fn(),
      isUploading: false,
    } as unknown as ReturnType<typeof useUploadProfilePhoto>);
    useRemoveProfilePhoto.mockReturnValue({
      removePhoto: vi.fn(),
      removePhotoAsync: vi.fn(),
      isRemoving: false,
    } as unknown as ReturnType<typeof useRemoveProfilePhoto>);
  });

  it("renders page title and subtitle", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Minha conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie seus dados, endereços e preferências de privacidade/)
    ).toBeInTheDocument();
  });

  it("renders Dados pessoais and Contato e identidade sections", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Dados pessoais")).toBeInTheDocument();
    expect(screen.getByText("Contato e identidade")).toBeInTheDocument();
  });

  it("renders AddressesSection", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId("addresses-section")).toBeInTheDocument();
  });

  it("renders PrivacySection and DangerZoneSection", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Privacidade e LGPD")).toBeInTheDocument();
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
  });

  it("renders AccountErrorState when profile failed to load", () => {
    useAccountProfile.mockReturnValue({
      profile: null,
      isLoading: false,
      error: "network",
      refetch: vi.fn(),
    } as ReturnType<typeof useAccountProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Não foi possível carregar sua conta")).toBeInTheDocument();
  });

  it("renders skeletons while profile is loading", () => {
    useAccountProfile.mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAccountProfile>);

    const { container } = render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders LogoutSection", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Sessão")).toBeInTheDocument();
  });

  it("debounces auto-save when full name changes", async () => {
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync,
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "Maria Silva Costa" },
    });

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(updateProfileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Maria Silva Costa" })
    );

    vi.useRealTimers();
  });

  it("uploads profile photo when a valid file is selected", async () => {
    const uploadPhotoAsync = vi.fn().mockResolvedValue(undefined);
    useUploadProfilePhoto.mockReturnValue({
      uploadPhoto: vi.fn(),
      uploadPhotoAsync,
      isUploading: false,
    } as unknown as ReturnType<typeof useUploadProfilePhoto>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Selecionar foto"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadPhotoAsync).toHaveBeenCalledWith(file);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
