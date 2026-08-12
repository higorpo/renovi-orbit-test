import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { ProviderProfessionalProfilePage } from "../ProviderProfessionalProfilePage";
import { useProviderSettingsForm } from "../../../hooks/useProviderSettingsForm";
import type { ProviderAccountFormData } from "../../../types/providerAccountForm.validation";

vi.mock("../../../hooks/useProviderSettingsForm");
vi.mock("../../SettingsRoleGate", () => ({
  SettingsRoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../OfferedServicesSection", () => ({
  OfferedServicesSection: () => <div>Serviços oferecidos stub</div>,
}));
vi.mock("../../ServiceAreaField", () => ({
  ServiceAreaSection: () => <div>Área de atuação stub</div>,
}));
vi.mock("../../PublicProfileSettingsSection", () => ({
  PublicProfileSettingsSection: () => <div>Perfil público stub</div>,
}));
vi.mock("../../PortfolioManagementSection", () => ({
  PortfolioManagementSection: () => <div>Portfólio stub</div>,
}));

const defaultValues: ProviderAccountFormData = {
  full_name: "Maria Silva",
  phone: "",
  entity_type: "pf",
  profile_visibility: "restricted",
  display_name: "",
  bio: "",
  service_area_neighborhood_ids: [],
};

function Harness() {
  const form = useForm<ProviderAccountFormData>({ defaultValues });
  vi.mocked(useProviderSettingsForm).mockReturnValue({
    profile: { id: "p1" },
    profileLoading: false,
    profileError: null,
    refetch: vi.fn(),
    publicData: { slug: "maria" },
    form,
    isUpdating: false,
    offeredServiceIds: [],
    setOfferedServiceIds: vi.fn(),
    setServiceIds: vi.fn(),
    isUpdatingServices: false,
    portfolioItems: [],
    createItemWithImages: vi.fn(),
    updateItemWithImages: vi.fn(),
    deleteItem: vi.fn(),
    reorderItems: vi.fn(),
    isCreatingPortfolio: false,
    isUpdatingPortfolio: false,
    isDeletingPortfolio: false,
  } as never);
  return <ProviderProfessionalProfilePage />;
}

describe("ProviderProfessionalProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Pedidos tab content by default", () => {
    render(<Harness />);

    expect(screen.getByRole("tab", { name: "Pedidos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Serviços oferecidos stub")).toBeVisible();
    expect(screen.getByText("Área de atuação stub")).toBeVisible();
    expect(screen.queryByText("Perfil público stub")).not.toBeInTheDocument();
    expect(screen.queryByText("Portfólio stub")).not.toBeInTheDocument();
  });

  it("shows vitrine cards after switching tabs", () => {
    render(<Harness />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Vitrine" }), { button: 0 });

    expect(screen.getByRole("tab", { name: "Vitrine" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Perfil público stub")).toBeVisible();
    expect(screen.getByText("Portfólio stub")).toBeVisible();
    expect(screen.queryByText("Serviços oferecidos stub")).not.toBeInTheDocument();
  });

  it("keeps the settings page header copy", () => {
    render(<Harness />);

    expect(
      screen.getByRole("heading", { name: "Perfil profissional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pedidos que você recebe e como os clientes te veem"),
    ).toBeInTheDocument();
  });
});
