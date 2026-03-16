import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { AddressFormDialog } from "../AddressFormDialog";
import type { ClientAddressWithRelations } from "../../../types/addresses.types";

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
  useAddressMapSync: vi.fn(() => ({
    handleMapDrag: vi.fn(),
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

vi.mock("../../AddressFormWithMap/AddressFormWithMap", () => ({
  AddressFormWithMap: () => <div data-testid="address-form-with-map">Form fields</div>,
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const createAddress = vi.mocked(await import("../../../api/addresses.api").then((m) => m.createAddress));
const updateAddress = vi.mocked(await import("../../../api/addresses.api").then((m) => m.updateAddress));

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
    city_id: "c1",
    state_id: "s1",
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
      states: [{ id: "s1", name: "São Paulo", abbreviation: "SP", ibge_code: 35, is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    usePlatformCities.mockReturnValue({
      cities: [{ id: "c1", name: "São Paulo", state_id: "s1", ibge_code: 3550308, is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    usePlatformNeighborhoods.mockReturnValue({
      neighborhoods: [{ id: "n1", name: "Centro", city_id: "c1", is_active: true, created_at: "", updated_at: "" }],
      isLoading: false,
      error: null,
    });
    createAddress.mockResolvedValue({ address: { id: "new-1" } as never, error: null });
    updateAddress.mockResolvedValue({ error: null });
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
});
