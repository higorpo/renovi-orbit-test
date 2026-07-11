import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { createElement } from "react";
import { MyAccountClientPage } from "../MyAccountClientPage";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

  it("removes profile photo when user confirms remove", async () => {
    const removePhotoAsync = vi.fn().mockResolvedValue(undefined);
    useRemoveProfilePhoto.mockReturnValue({
      removePhoto: vi.fn(),
      removePhotoAsync,
      isRemoving: false,
    } as unknown as ReturnType<typeof useRemoveProfilePhoto>);
    useAccountProfile.mockReturnValue({
      profile: {
        id: "u1",
        role: "client",
        full_name: "Maria Silva",
        phone: null,
        cpf: null,
        created_at: "2024-01-15T00:00:00Z",
        profile_image_path: "profiles/u1/avatar.jpg",
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useAccountProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /Remover foto/ }));

    await waitFor(() => {
      expect(removePhotoAsync).toHaveBeenCalledWith("profiles/u1/avatar.jpg");
    });
  });

  it("shows Salvando while a profile mutation is in flight", () => {
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: true,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Salvando…")).toBeInTheDocument();
  });

  it("sets form error when auto-save receives an invalid full name", async () => {
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync,
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "" },
    });

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(updateProfileAsync).not.toHaveBeenCalled();
    expect(screen.getByText("Nome é obrigatório")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("toasts error when auto-save mutations partially fail", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: "fail" });
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
    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Não foi possível salvar todas as alterações/i)
    );
    vi.useRealTimers();
  });

  it("toasts error when auto-save mutation rejects", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockRejectedValue(new Error("network"));
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
    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Não foi possível atualizar seus dados/i)
    );
    vi.useRealTimers();
  });

  it("renders saved cards when profile finished loading", () => {
    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId("saved-cards-section")).toBeInTheDocument();
    expect(screen.getByTestId("payment-history-section")).toBeInTheDocument();
  });

  it("clears pending auto-save timer on unmount", async () => {
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync,
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    const { unmount } = render(<MyAccountClientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "Maria Silva Costa" },
    });

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(updateProfileAsync).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("resets the debounce timer when the form changes again before save", async () => {
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
      vi.advanceTimersByTime(800);
    });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "Maria Silva Souza" },
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(updateProfileAsync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateProfileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Maria Silva Souza" })
    );
    vi.useRealTimers();
  });

  it("auto-saves phone and cpf together on success", async () => {
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: null });
    const updateCpfAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync,
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);
    useClientPrivateProfile.mockReturnValue({
      cpf: null,
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateCpfAsync,
      isUpdating: false,
    } as ReturnType<typeof useClientPrivateProfile>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Telefone/), {
      target: { value: "(11) 98888-7777" },
    });
    fireEvent.change(screen.getByLabelText(/^CPF$/), {
      target: { value: "529.982.247-25" },
    });

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateProfileAsync).toHaveBeenCalled();
    expect(updateCpfAsync).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: expect.stringMatching(/529/) })
    );
    vi.useRealTimers();
  });

  it("does not remove photo when profile has no image path", async () => {
    const removePhotoAsync = vi.fn().mockResolvedValue(undefined);
    useRemoveProfilePhoto.mockReturnValue({
      removePhoto: vi.fn(),
      removePhotoAsync,
      isRemoving: false,
    } as unknown as ReturnType<typeof useRemoveProfilePhoto>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });

    expect(screen.queryByRole("button", { name: /Remover foto/ })).not.toBeInTheDocument();
    expect(removePhotoAsync).not.toHaveBeenCalled();
  });

  it("renders with empty email when auth user has no email", () => {
    useAuth.mockReturnValue({
      user: { id: "u1", email: undefined },
    } as ReturnType<typeof useAuth>);

    render(<MyAccountClientPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Minha conta")).toBeInTheDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
