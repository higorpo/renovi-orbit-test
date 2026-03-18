import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { createElement } from "react";
import { MyAccountClientPage } from "../MyAccountClientPage";

vi.mock("@/features/auth", () => ({ useAuth: vi.fn() }));
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
vi.mock("../../hooks/useExportData", () => ({ useExportData: vi.fn() }));
vi.mock("../../hooks/useDeleteAccount", () => ({ useDeleteAccount: vi.fn() }));
vi.mock("@/features/addresses", () => ({
  AddressesSection: () => <div data-testid="addresses-section">Endereços</div>,
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
const useExportData = vi.mocked(
  await import("../../hooks/useExportData").then((m) => m.useExportData)
);
const useDeleteAccount = vi.mocked(
  await import("../../hooks/useDeleteAccount").then((m) => m.useDeleteAccount)
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
      updateProfileAsync: vi.fn().mockResolvedValue({ error: null }),
      isUpdating: false,
    } as ReturnType<typeof useUpdateAccountProfile>);
    useUploadProfilePhoto.mockReturnValue({
      uploadPhotoAsync: vi.fn(),
      isUploading: false,
    } as ReturnType<typeof useUploadProfilePhoto>);
    useRemoveProfilePhoto.mockReturnValue({
      removePhotoAsync: vi.fn(),
      isRemoving: false,
    } as ReturnType<typeof useRemoveProfilePhoto>);
    useExportData.mockReturnValue({
      requestExport: vi.fn(),
      isExporting: false,
    } as ReturnType<typeof useExportData>);
    useDeleteAccount.mockReturnValue({
      requestDelete: vi.fn(),
      isDeleting: false,
    } as ReturnType<typeof useDeleteAccount>);
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
});
