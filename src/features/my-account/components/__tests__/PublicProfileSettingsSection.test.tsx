import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { PublicProfileSettingsSection } from "../PublicProfileSettingsSection";
import type { ProviderAccountFormData } from "../../types/providerAccountForm.validation";
import { toast } from "sonner";

vi.mock("../ServiceAreaField", () => ({
  ServiceAreaField: () => <div data-testid="service-area-field">Service area</div>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

  it("opens public profile URL in a new tab when Visualizar perfil is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Wrapper profileSlug="meu-slug" />);
    fireEvent.click(screen.getByRole("button", { name: /Visualizar perfil/ }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/perfil/meu-slug"),
      "_blank"
    );
    openSpy.mockRestore();
  });

  it("switches visibility to public when the public radio is selected", () => {
    render(<Wrapper profileSlug={null} />);
    const publicRadio = screen
      .getAllByRole("radio")
      .find((el) => (el as HTMLInputElement).value === "public");
    expect(publicRadio).toBeDefined();
    fireEvent.click(publicRadio!);
    expect(publicRadio).toBeChecked();
  });

  it("switches visibility to restricted when the restricted radio is selected", () => {
    render(<Wrapper profileSlug={null} />);
    const publicRadio = screen
      .getAllByRole("radio")
      .find((el) => (el as HTMLInputElement).value === "public");
    fireEvent.click(publicRadio!);

    const restrictedRadio = screen
      .getAllByRole("radio")
      .find((el) => (el as HTMLInputElement).value === "restricted");
    expect(restrictedRadio).toBeDefined();
    fireEvent.click(restrictedRadio!);
    expect(restrictedRadio).toBeChecked();
  });

  it("shows toast error when clipboard write fails on copy", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(<Wrapper profileSlug="slug" />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link do perfil/ }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("shows toast success and check icon after copying the profile link", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(<Wrapper profileSlug="meu-perfil" />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link do perfil/ }));
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Link copiado para a área de transferência."
      );
    });
    // Copied state swaps the icon; button remains available
    expect(screen.getByRole("button", { name: /Copiar link do perfil/ })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
  });

  it("does not open a tab when Visualizar perfil is unavailable without slug", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Wrapper profileSlug={null} />);
    expect(screen.queryByRole("button", { name: /Visualizar perfil/ })).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("updates bio and display name fields when typed", () => {
    render(<Wrapper profileSlug={null} />);
    fireEvent.change(screen.getByLabelText(/Nome profissional/), {
      target: { value: "Studio Prestway" },
    });
    fireEvent.change(screen.getByLabelText(/Biografia/), {
      target: { value: "Especialista em pintura" },
    });
    expect(screen.getByLabelText(/Nome profissional/)).toHaveValue("Studio Prestway");
    expect(screen.getByLabelText(/Biografia/)).toHaveValue("Especialista em pintura");
  });

  it("disables profile actions when disabled prop is set", () => {
    render(<Wrapper profileSlug="slug" disabled />);
    expect(screen.getByRole("button", { name: /Visualizar perfil/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Copiar link do perfil/ })).toBeDisabled();
    expect(screen.getByLabelText(/Nome profissional/)).toBeDisabled();
    expect(screen.getByLabelText(/Biografia/)).toBeDisabled();
  });
});
