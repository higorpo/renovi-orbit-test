import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { PublicProfileSettingsSection } from "../PublicProfileSettingsSection";
import type { ProviderAccountFormData } from "../../schemas/providerAccountForm.validation";

vi.mock("../ServiceAreaField", () => ({
  ServiceAreaField: () => <div data-testid="service-area-field">Service area</div>,
}));

const defaultValues: ProviderAccountFormData = {
  full_name: "Maria",
  phone: "",
  entity_type: "pf",
  profile_visibility: "restricted",
  display_name: "",
  bio: "",
  service_area_neighborhood_ids: [],
};

function Wrapper({
  profileSlug,
  disabled,
}: {
  profileSlug: string | null;
  disabled?: boolean;
}) {
  const form = useForm<ProviderAccountFormData>({ defaultValues });
  return (
    <Form {...form}>
      <PublicProfileSettingsSection
        form={form}
        profileSlug={profileSlug}
        disabled={disabled}
      />
    </Form>
  );
}

describe("PublicProfileSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  it("renders section title and display name field", () => {
    render(<Wrapper profileSlug={null} />);
    expect(screen.getByText("Perfil público")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Nome profissional/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Biografia/)).toBeInTheDocument();
  });

  it("renders visibility options", () => {
    render(<Wrapper profileSlug={null} />);
    expect(screen.getByText(/Público — qualquer pessoa/)).toBeInTheDocument();
    expect(screen.getByText(/Restrito — apenas clientes/)).toBeInTheDocument();
  });

  it("renders Visualizar perfil and Copiar link when profileSlug is set", () => {
    render(<Wrapper profileSlug="meu-perfil" />);
    expect(
      screen.getByRole("button", { name: /Visualizar perfil/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copiar link do perfil/ })
    ).toBeInTheDocument();
  });

  it("copies profile URL to clipboard when Copiar link is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(<Wrapper profileSlug="meu-perfil" />);
    fireEvent.click(
      screen.getByRole("button", { name: /Copiar link do perfil/ })
    );
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/perfil/meu-perfil")
    );
  });

  it("renders ServiceAreaField", () => {
    render(<Wrapper profileSlug={null} />);
    expect(screen.getByTestId("service-area-field")).toBeInTheDocument();
  });
});
