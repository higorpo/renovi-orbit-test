import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { MyAccountPage } from "../MyAccountPage";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "user@example.com" },
    profile: {
      id: "user-1",
      role: "client",
      full_name: "Maria Silva",
      phone: null,
      cpf: null,
    },
  })),
  profileApi: { updateProfile: vi.fn(() => Promise.resolve({ error: null })) },
}));

vi.mock("../../hooks/useAccountProfile", () => ({
  useAccountProfile: vi.fn(() => ({
    profile: {
      id: "user-1",
      role: "client",
      full_name: "Maria Silva",
      phone: null,
      cpf: null,
      created_at: "2024-01-15T00:00:00Z",
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock("../../hooks/useUpdateAccountProfile", () => ({
  useUpdateAccountProfile: vi.fn(() => ({
    updateProfileAsync: vi.fn(() => Promise.resolve({ error: null })),
    isUpdating: false,
  })),
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

vi.mock("@/features/addresses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/addresses")>();
  return {
    ...actual,
    AddressesSection: () => (
      <>
        <div>Endereços</div>
        <p>Gerencie seus endereços de atendimento.</p>
      </>
    ),
  };
});

vi.mock("../../hooks/useExportData", () => ({
  useExportData: vi.fn(() => ({
    requestExport: vi.fn(),
    isExporting: false,
  })),
}));

vi.mock("../../hooks/useDeleteAccount", () => ({
  useDeleteAccount: vi.fn(() => ({
    requestDelete: vi.fn(),
    isDeleting: false,
  })),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyAccountPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("MyAccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and subtitle", () => {
    renderPage();
    expect(screen.getByText("Minha conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie seus dados, endereços e preferências de privacidade/)
    ).toBeInTheDocument();
  });

  it("renders account summary with user name and email", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Maria Silva" })).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("renders Dados pessoais section", () => {
    renderPage();
    expect(screen.getByText("Dados pessoais")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo/)).toBeInTheDocument();
  });

  it("renders Contato e identidade section", () => {
    renderPage();
    expect(screen.getByText("Contato e identidade")).toBeInTheDocument();
  });

  it("renders Endereços section", () => {
    renderPage();
    expect(screen.getByText("Endereços")).toBeInTheDocument();
  });

  it("renders Privacidade e LGPD section", () => {
    renderPage();
    expect(screen.getByText("Privacidade e LGPD")).toBeInTheDocument();
  });

  it("renders Zona de perigo section", () => {
    renderPage();
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
  });

  it("shows auto-save hint when not updating", () => {
    renderPage();
    expect(
      screen.getByText(/As alterações são salvas automaticamente/i)
    ).toBeInTheDocument();
  });
});
