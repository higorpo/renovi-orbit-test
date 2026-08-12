import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { createElement } from "react";
import { SettingsProviderPage } from "../SettingsProviderPage";

vi.mock("nsfwjs", () => ({ load: vi.fn().mockResolvedValue({ classify: vi.fn() }) }));
vi.mock("@/features/request-quote/utils/photoContentCheck", () => ({
  checkPhotoContent: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/payments", () => ({
  PaymentHistorySection: () =>
    createElement("div", { "data-testid": "payment-history-section" }, "Pagamentos"),
}));

vi.mock("../../hooks/useProfileImageUrl", () => ({
  useProfileImageUrl: () => ({ url: null, isLoading: false }),
}));

vi.mock("../../api/profileImageStorage.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/profileImageStorage.api")>(
    "../../api/profileImageStorage.api"
  );
  return {
    ...actual,
    validateProfileImageFile: vi.fn(() => null),
  };
});

vi.mock("@/features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth")>();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});
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
const useUploadProfilePhoto = vi.mocked(
  await import("../../hooks/useProfilePhotoMutation").then((m) => m.useUploadProfilePhoto)
);
const useRemoveProfilePhoto = vi.mocked(
  await import("../../hooks/useProfilePhotoMutation").then((m) => m.useRemoveProfilePhoto)
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

describe("SettingsProviderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "p1", email: "provider@example.com" },
    } as ReturnType<typeof useAuth>);
    useProviderProfile.mockReturnValue({
      profile: { id: "p1", role: "provider", full_name: "João Silva" },
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
    useUploadProfilePhoto.mockReturnValue({
      uploadPhoto: vi.fn(),
      uploadPhotoAsync: vi.fn(),
      isUploading: false,
    } as unknown as ReturnType<typeof useUploadProfilePhoto>);
  });

  it("renders page title and subtitle", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie seus dados, identidade profissional e perfil público/)
    ).toBeInTheDocument();
  });

  it("renders Tipo de entidade section", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Tipo de entidade")).toBeInTheDocument();
  });

  it("renders Serviços oferecidos and Perfil público sections", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Serviços oferecidos")).toBeInTheDocument();
    expect(screen.getByText("Perfil público")).toBeInTheDocument();
  });

  it("renders Portfólio and Zona de perigo", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Portfólio")).toBeInTheDocument();
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
  });

  it("renders AccountErrorState when profile failed to load", () => {
    useProviderProfile.mockReturnValue({
      profile: null,
      privateData: null,
      publicData: null,
      isLoading: false,
      error: new Error("fail"),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Não foi possível carregar sua conta")).toBeInTheDocument();
  });

  it("renders skeletons while profile is loading", () => {
    useProviderProfile.mockReturnValue({
      profile: null,
      privateData: null,
      publicData: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProviderProfile>);

    const { container } = render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders LogoutSection", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Sessão")).toBeInTheDocument();
  });

  it("debounces auto-save when provider full name changes", async () => {
    vi.useFakeTimers();
    const updateProfileAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync,
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Pereira Silva" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(updateProfileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "João Pereira Silva" })
    );

    vi.useRealTimers();
  });

  it("copies public profile link from the summary card", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    const copyButtons = screen.getAllByRole("button", { name: /Copiar link do perfil/ });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/perfil\/joao$/)
      );
    });
  });

  it("removes profile photo when user confirms remove", async () => {
    const removePhotoAsync = vi.fn().mockResolvedValue(undefined);
    useRemoveProfilePhoto.mockReturnValue({
      removePhoto: vi.fn(),
      removePhotoAsync,
      isRemoving: false,
    } as unknown as ReturnType<typeof useRemoveProfilePhoto>);

    useProviderProfile.mockReturnValue({
      profile: {
        id: "p1",
        role: "provider",
        full_name: "João",
        profile_image_path: "profiles/p1/avatar.jpg",
      },
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

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /Remover foto/ }));

    await waitFor(() => {
      expect(removePhotoAsync).toHaveBeenCalledWith("profiles/p1/avatar.jpg");
    });
  });

  it("uploads profile photo when a valid file is selected", async () => {
    const uploadPhotoAsync = vi.fn().mockResolvedValue(undefined);
    useUploadProfilePhoto.mockReturnValue({
      uploadPhoto: vi.fn(),
      uploadPhotoAsync,
      isUploading: false,
    } as unknown as ReturnType<typeof useUploadProfilePhoto>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Selecionar foto"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadPhotoAsync).toHaveBeenCalledWith(file);
    });
  });

  it("shows Salvando while a profile mutation is in flight", () => {
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: true,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Salvando…")).toBeInTheDocument();
  });

  it("toasts validation error when auto-save receives an invalid full name", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/campo inválido/i)
    );
    vi.useRealTimers();
  });

  it("auto-saves private profile fields when CPF changes", async () => {
    vi.useFakeTimers();
    const updatePrivateAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync,
      updatePublicAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^CPF$/), {
      target: { value: "529.982.247-25" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updatePrivateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: expect.stringMatching(/529/) })
    );
    vi.useRealTimers();
  });

  it("auto-saves public profile fields when display name changes", async () => {
    vi.useFakeTimers();
    const updatePublicAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync,
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome profissional/), {
      target: { value: "João Prestador" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updatePublicAsync).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "João Prestador" })
    );
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

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Pereira Silva" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Não foi possível salvar todas as alterações/i)
    );
    vi.useRealTimers();
  });

  it("toasts error when clipboard copy fails", async () => {
    const { toast } = await import("sonner");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
      writable: true,
    });

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByRole("button", { name: /Copiar link do perfil/ })[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível copiar.");
    });
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

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Pereira Silva" },
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Não foi possível atualizar seus dados/i)
    );
    vi.useRealTimers();
  });

  it("masks phone input as the user types", () => {
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    const phone = screen.getByLabelText(/Telefone \/ WhatsApp/);
    fireEvent.change(phone, { target: { value: "48999887766" } });
    expect(phone).toHaveValue("(48) 99988-7766");
  });

  it("keeps rendering the account when a profile is present with an error", () => {
    const current = useProviderProfile();
    useProviderProfile.mockReturnValue({
      ...current,
      error: new Error("stale refresh failed"),
    } as ReturnType<typeof useProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar sua conta")
    ).not.toBeInTheDocument();
  });

  it("does not expose copy profile actions when slug is null", () => {
    const current = useProviderProfile();
    useProviderProfile.mockReturnValue({
      ...current,
      publicData: { ...current.publicData!, slug: null },
    } as ReturnType<typeof useProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    expect(
      screen.queryByRole("button", { name: /Copiar link do perfil/ })
    ).not.toBeInTheDocument();
  });

  it("shows a success toast after a successful auto-save", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Atualizado" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Dados atualizados com sucesso."
    );
  });

  it("omits neighborhoods when only bio is dirty", async () => {
    vi.useFakeTimers();
    const updatePublicAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync,
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Biografia/), {
      target: { value: "Especialista em reformas" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(updatePublicAsync).toHaveBeenCalledWith({
      display_name: "João",
      bio: "Especialista em reformas",
      profile_visibility: "restricted",
    });
  });

  it("switches to the PJ fields and shows saving for private updates", () => {
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdatingPrivate: true,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));

    expect(screen.getByLabelText(/CNPJ/)).toBeInTheDocument();
    expect(screen.getByText("Salvando…")).toBeInTheDocument();
  });

  it("shows Salvando when isUpdatingPublic is true", () => {
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdatingPrivate: false,
      isUpdatingPublic: true,
    } as ReturnType<typeof useUpdateProviderProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Salvando…")).toBeInTheDocument();
  });

  it("keeps the profile form skeleton visible while an identified profile is loading", () => {
    const current = useProviderProfile();
    useProviderProfile.mockReturnValue({
      ...current,
      isLoading: true,
    } as ReturnType<typeof useProviderProfile>);

    const { container } = render(<SettingsProviderPage />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Nome completo/)).not.toBeInTheDocument();
  });

  it("does not rehydrate the form twice for the same profile id", () => {
    const initial = useProviderProfile();
    const { rerender } = render(<SettingsProviderPage />, {
      wrapper: createWrapper(),
    });

    useProviderProfile.mockReturnValue({
      ...initial,
      profile: {
        ...initial.profile!,
        full_name: "Server refresh",
      },
    } as ReturnType<typeof useProviderProfile>);
    rerender(<SettingsProviderPage />);

    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("João Silva");
  });

  it("renders without a summary card when no profile is available and no error occurred", () => {
    const current = useProviderProfile();
    useProviderProfile.mockReturnValue({
      ...current,
      profile: null,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useProviderProfile>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
  });

  it("uses an empty email when the authenticated user has none", () => {
    useAuth.mockReturnValue({
      user: { id: "p1" },
    } as ReturnType<typeof useAuth>);

    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("normalizes a cleared CPF to null during auto-save", async () => {
    vi.useFakeTimers();
    const updatePrivateAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync,
      updatePublicAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });
    const cpf = screen.getByLabelText(/^CPF$/);

    fireEvent.change(cpf, { target: { value: "529.982.247-25" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    updatePrivateAsync.mockClear();

    fireEvent.change(cpf, { target: { value: "" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(updatePrivateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: null })
    );
  });

  it("normalizes a missing display name to null when saving another public field", async () => {
    vi.useFakeTimers();
    const current = useProviderProfile();
    useProviderProfile.mockReturnValue({
      ...current,
      publicData: {
        ...current.publicData!,
        display_name: null,
      },
    } as ReturnType<typeof useProviderProfile>);
    const updatePublicAsync = vi.fn().mockResolvedValue({ error: null });
    useUpdateProviderProfile.mockReturnValue({
      updatePrivateAsync: vi.fn().mockResolvedValue({ error: null }),
      updatePublicAsync,
      isUpdatingPrivate: false,
      isUpdatingPublic: false,
    } as ReturnType<typeof useUpdateProviderProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Biografia/), {
      target: { value: "Nova biografia" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(updatePublicAsync).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: null })
    );
  });

  it("handles an undefined mutation result as a partial auto-save failure", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockResolvedValue(undefined),
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Sem Resultado" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível salvar todas as alterações. Tente novamente."
    );
  });

  it("handles a non-Error auto-save rejection", async () => {
    const { toast } = await import("sonner");
    vi.useFakeTimers();
    useUpdateAccountProfile.mockReturnValue({
      updateProfile: vi.fn(),
      updateProfileAsync: vi.fn().mockRejectedValue("offline"),
      isUpdating: false,
    } as unknown as ReturnType<typeof useUpdateAccountProfile>);
    render(<SettingsProviderPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: "João Offline" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível atualizar seus dados. Tente novamente."
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
