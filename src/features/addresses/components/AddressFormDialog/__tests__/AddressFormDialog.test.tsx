import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { AddressFormDialog } from "../AddressFormDialog";
import type { ClientAddressWithRelations } from "../../../types/addresses.types";

const ids = {
  state: "11111111-1111-4111-8111-111111111111",
  city: "22222222-2222-4222-8222-222222222222",
  neighborhood: "33333333-3333-4333-8333-333333333333",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => true),
}));

vi.mock("../../../hooks/usePlatformStatesAndCities", () => ({
  usePlatformStates: vi.fn(),
  usePlatformCities: vi.fn(),
  usePlatformNeighborhoods: vi.fn(),
}));

vi.mock("../../../hooks/useAddressMapSync", () => ({
  useAddressMapSync: vi.fn(({ setLocation }: { setLocation: (loc: { latitude: number; longitude: number }) => void }) => ({
    handleMapDrag: (lat: number, lng: number) => setLocation({ latitude: lat, longitude: lng }),
    reverseGeocoding: false,
    triggerGeocodeNow: vi.fn(),
  })),
}));

vi.mock("../../../api/addresses.api", () => ({
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
}));

vi.mock("../../../utils/resolveFormDataFromCep", () => ({
  resolveFormDataFromCep: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../AddressFormWithMap/AddressFormWithMap", () => ({
  AddressFormWithMap: (props: {
    setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onStateChange: (id: string) => void;
    onCityChange: (id: string) => void;
    onNeighborhoodChange: (id: string) => void;
    handleCepBlur: () => void;
    onLocationChange?: (lat: number, lng: number) => void;
  }) => (
    <div data-testid="address-form-with-map">
      <button
        type="button"
        onClick={() =>
          props.setFormData((current) => ({
            ...current,
            address_label: "Trabalho",
            address_zip: "01310-100",
            address_street: "Avenida Paulista",
            address_number: "100",
            address_complement: "Sala 2",
            address_neighborhood_id: ids.neighborhood,
            address_neighborhood: "Bela Vista",
            address_state_id: ids.state,
            address_state: "SP",
            address_city_id: ids.city,
            address_city: "São Paulo",
          }))
        }
      >
        Fill valid form
      </button>
      <button
        type="button"
        onClick={() =>
          props.setFormData((current) => ({
            ...current,
            address_zip: "01310-100",
          }))
        }
      >
        Set CEP only
      </button>
      <button type="button" onClick={() => props.onStateChange(ids.state)}>
        Select state
      </button>
      <button type="button" onClick={() => props.onCityChange(ids.city)}>
        Select city
      </button>
      <button type="button" onClick={() => props.onNeighborhoodChange(ids.neighborhood)}>
        Select neighborhood
      </button>
      <button type="button" onClick={props.handleCepBlur}>
        Blur CEP
      </button>
      <button type="button" onClick={() => props.onLocationChange?.(-23.5, -46.6)}>
        Set map location
      </button>
    </div>
  ),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const createAddress = vi.mocked(await import("../../../api/addresses.api").then((m) => m.createAddress));
const updateAddress = vi.mocked(await import("../../../api/addresses.api").then((m) => m.updateAddress));
const resolveFormDataFromCep = vi.mocked(
  await import("../../../utils/resolveFormDataFromCep").then((m) => m.resolveFormDataFromCep)
);

const usePlatformStates = vi.mocked(
  await import("../../../hooks/usePlatformStatesAndCities").then((m) => m.usePlatformStates)
);
const usePlatformCities = vi.mocked(
  await import("../../../hooks/usePlatformStatesAndCities").then((m) => m.usePlatformCities)
);
const usePlatformNeighborhoods = vi.mocked(
  await import("../../../hooks/usePlatformStatesAndCities").then((m) => m.usePlatformNeighborhoods)
);

function mockAddress(overrides: Partial<ClientAddressWithRelations> = {}): ClientAddressWithRelations {
  return {
    id: "addr-1",
    client_id: "user-1",
    label: "Casa",
    street: "Rua A",
    number: "10",
    complement: null,
    neighborhood: "Centro",
    city_id: ids.city,
    state_id: ids.state,
    zip_code: "01310100",
    is_default: false,
    is_active: true,
    created_at: "",
    updated_at: "",
    platform_cities: { name: "São Paulo" },
    platform_states: { abbreviation: "SP" },
    ...overrides,
  } as ClientAddressWithRelations;
}

describe("AddressFormDialog", () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: "user-1", email: "u@e.com" }, profile: null } as ReturnType<typeof useAuth>);
    usePlatformStates.mockReturnValue({
      states: [{ id: ids.state, name: "São Paulo", abbreviation: "SP", ibge_code: 35, is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    usePlatformCities.mockReturnValue({
      cities: [{ id: ids.city, name: "São Paulo", state_id: ids.state, ibge_code: 3550308, is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    usePlatformNeighborhoods.mockReturnValue({
      neighborhoods: [{ id: ids.neighborhood, name: "Centro", city_id: ids.city, is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    createAddress.mockResolvedValue({ address: { id: "new-1" } as never, error: null });
    updateAddress.mockResolvedValue({ error: null });
    resolveFormDataFromCep.mockResolvedValue(null);
  });

  it("renders add title when mode is add and open", () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    expect(screen.getByRole("heading", { name: /Adicionar endereço/ })).toBeInTheDocument();
    expect(screen.getByTestId("address-form-with-map")).toBeInTheDocument();
  });

  it("renders edit title when mode is edit and open", () => {
    const address = mockAddress();
    render(
      <AddressFormDialog open mode="edit" address={address} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    expect(screen.getByRole("heading", { name: /Editar endereço/ })).toBeInTheDocument();
  });

  it("calls onClose when Cancelar is clicked", () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render content when open is false", () => {
    render(
      <AddressFormDialog open={false} mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    expect(screen.queryByRole("heading", { name: /Adicionar endereço/ })).not.toBeInTheDocument();
  });

  it("creates an address and closes after a valid submission", async () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith({
        client_id: "user-1",
        label: "Trabalho",
        street: "Avenida Paulista",
        number: "100",
        complement: "Sala 2",
        neighborhood: "Bela Vista",
        city_id: ids.city,
        state_id: ids.state,
        zip_code: "01310100",
        is_default: false,
        is_active: true,
      });
    });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates the current address in edit mode", async () => {
    const address = mockAddress();
    render(
      <AddressFormDialog open mode="edit" address={address} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateAddress).toHaveBeenCalledWith(
        "addr-1",
        "user-1",
        expect.objectContaining({
          label: "Trabalho",
          zip_code: "01310100",
          city_id: ids.city,
        })
      );
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("does not close when address creation returns an error", async () => {
    createAddress.mockResolvedValue({ address: null, error: "save failed" });
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createAddress).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resolves a complete CEP once", async () => {
    resolveFormDataFromCep.mockResolvedValue({
      ok: true,
      data: {
        address_street: "Rua resolvida",
        address_state_id: ids.state,
        address_state: "SP",
        address_city_id: ids.city,
        address_city: "São Paulo",
        address_neighborhood_id: ids.neighborhood,
        address_neighborhood: "Centro",
      },
    });
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    await waitFor(() =>
      expect(resolveFormDataFromCep).toHaveBeenCalledWith("01310-100")
    );
    fireEvent.click(screen.getByRole("button", { name: "Blur CEP" }));
    expect(resolveFormDataFromCep).toHaveBeenCalledTimes(1);
  });

  it("uses the mobile sheet layout below the desktop breakpoint", async () => {
    const useBreakpointMd = vi.mocked(
      await import("@/hooks/useBreakpoint").then((module) => module.useBreakpointMd)
    );
    useBreakpointMd.mockReturnValueOnce(false);

    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Adicionar endereço" })).toBeInTheDocument();
  });

  it("toasts when CEP is not found", async () => {
    const { toast } = await import("sonner");
    resolveFormDataFromCep.mockResolvedValue({ ok: false, cepNotFound: true });

    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Set CEP only" }));
    await waitFor(() => expect(resolveFormDataFromCep).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("CEP não encontrado.");
  });

  it("toasts when CEP is not available on the platform", async () => {
    const { toast } = await import("sonner");
    resolveFormDataFromCep.mockResolvedValue({ ok: false, notAvailable: true });

    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Set CEP only" }));
    await waitFor(() => expect(resolveFormDataFromCep).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("CEP ainda não disponível na nossa base.");
  });

  it("toasts validation errors instead of submitting", async () => {
    const { toast } = await import("sonner");
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(createAddress).not.toHaveBeenCalled();
  });

  it("does not close when address update returns an error", async () => {
    updateAddress.mockResolvedValue({ error: "update failed" });
    render(
      <AddressFormDialog
        open
        mode="edit"
        address={mockAddress()}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateAddress).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("matches neighborhood by name when editing without neighborhood id", async () => {
    usePlatformNeighborhoods.mockReturnValue({
      neighborhoods: [
        {
          id: ids.neighborhood,
          name: "Centro",
          city_id: ids.city,
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <AddressFormDialog
        open
        mode="edit"
        address={mockAddress({ neighborhood: "centro" })}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Select neighborhood" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateAddress).toHaveBeenCalledWith(
        "addr-1",
        "user-1",
        expect.objectContaining({ neighborhood: "Bela Vista" }),
      );
    });
  });

  it("updates cascading location fields from select handlers", async () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Select state" }));
    fireEvent.click(screen.getByRole("button", { name: "Select city" }));
    fireEvent.click(screen.getByRole("button", { name: "Select neighborhood" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createAddress).toHaveBeenCalled());
  });

  it("includes coordinates when location is set before create", async () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: "Set map location" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(createAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: -23.5,
          longitude: -46.6,
        }),
      );
    });
  });
});

describe("AddressFormDialog remaining dialog branches", () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: null, profile: null } as ReturnType<typeof useAuth>);
    usePlatformStates.mockReturnValue({
      states: [{ id: ids.state, name: "São Paulo", abbreviation: "SP" }] as never[],
      isLoading: false,
      error: null,
    });
    usePlatformCities.mockReturnValue({
      cities: [{ id: ids.city, name: "São Paulo", state_id: ids.state }] as never[],
      isLoading: false,
      error: null,
    });
    usePlatformNeighborhoods.mockReturnValue({
      neighborhoods: [{ id: ids.neighborhood, name: "Centro", city_id: ids.city }] as never[],
      isLoading: false,
      error: null,
    });
    createAddress.mockResolvedValue({ address: { id: "new-1" } as never, error: null });
    updateAddress.mockResolvedValue({ error: null });
    resolveFormDataFromCep.mockResolvedValue(null);
  });

  it("uses an empty client id when submitting without an authenticated user", async () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: "" }),
      ),
    );
  });

  it("persists valid coordinates loaded in edit mode", async () => {
    render(
      <AddressFormDialog
        open
        mode="edit"
        address={mockAddress({ latitude: -23.5, longitude: -46.6 })}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateAddress).toHaveBeenCalledWith(
        "addr-1",
        "",
        expect.objectContaining({ latitude: -23.5, longitude: -46.6 }),
      ),
    );
  });

  it("ignores non-finite coordinates loaded in edit mode", async () => {
    render(
      <AddressFormDialog
        open
        mode="edit"
        address={mockAddress({ latitude: Number.NaN, longitude: -46.6 })}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole("button", { name: "Fill valid form" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateAddress).toHaveBeenCalled());
    expect(updateAddress.mock.calls[0][2]).not.toHaveProperty("latitude");
    expect(updateAddress.mock.calls[0][2]).not.toHaveProperty("longitude");
  });

  it("does not resolve an incomplete CEP on blur", () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole("button", { name: "Blur CEP" }));
    expect(resolveFormDataFromCep).not.toHaveBeenCalled();
  });

  it("closes the desktop dialog through its open-state callback", () => {
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes the mobile sheet through its open-state callback", async () => {
    const useBreakpointMd = vi.mocked(
      await import("@/hooks/useBreakpoint").then((module) => module.useBreakpointMd),
    );
    useBreakpointMd.mockReturnValueOnce(false);
    render(
      <AddressFormDialog open mode="add" address={null} onClose={onClose} onSuccess={onSuccess} />,
      { wrapper },
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
