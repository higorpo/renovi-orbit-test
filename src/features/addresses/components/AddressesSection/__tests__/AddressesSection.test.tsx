import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressesSection } from "../AddressesSection";
import * as useAddressesListModule from "../../../hooks/useAddressesList";
import * as useAddressMutationsModule from "../../../hooks/useAddressMutations";
import type { ClientAddressWithRelations } from "../../../types/addresses.types";

vi.mock("../../../hooks/useAddressesList", () => ({
  useAddressesList: vi.fn(),
}));

vi.mock("../../../hooks/useAddressMutations", () => ({
  useSetDefaultAddress: vi.fn(),
  useDeleteAddress: vi.fn(),
}));

vi.mock("../../AddressFormDialog/AddressFormDialog", () => ({
  AddressFormDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="address-form-dialog"><button type="button" onClick={onClose}>Close form</button></div> : null,
}));

vi.mock("../../DeleteAddressDialog/DeleteAddressDialog", () => ({
  DeleteAddressDialog: ({
    open,
    address: _address,
    onClose,
    onConfirm,
  }: {
    open: boolean;
    address: unknown;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="delete-address-dialog">
        <button type="button" onClick={onClose}>Close delete</button>
        <button type="button" onClick={onConfirm}>Confirm delete</button>
      </div>
    ) : null,
}));

const useAddressesList = vi.mocked(useAddressesListModule.useAddressesList);
const useSetDefaultAddress = vi.mocked(useAddressMutationsModule.useSetDefaultAddress);
const useDeleteAddress = vi.mocked(useAddressMutationsModule.useDeleteAddress);

function mockAddress(overrides: Partial<ClientAddressWithRelations> = {}): ClientAddressWithRelations {
  return {
    id: "addr-1",
    client_id: "user-1",
    label: "Casa",
    street: "Rua A",
    number: "1",
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

describe("AddressesSection", () => {
  const refetch = vi.fn();
  const setDefault = vi.fn();
  const deleteAddressMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAddressesList.mockReturnValue({
      addresses: [],
      error: null,
      isLoading: false,
      refetch,
    });
    useSetDefaultAddress.mockReturnValue({
      setDefault,
      setDefaultAsync: vi.fn(),
      isSettingDefault: false,
    });
    useDeleteAddress.mockReturnValue({
      deleteAddress: deleteAddressMutation,
      deleteAddressAsync: vi.fn(),
      isDeleting: false,
    });
  });

  it("renders loading skeletons when isLoading is true", () => {
    useAddressesList.mockReturnValue({
      addresses: [],
      error: null,
      isLoading: true,
      refetch,
    });
    render(<AddressesSection />);
    expect(screen.getByText("Endereços")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar endereço/ })).not.toBeInTheDocument();
  });

  it("renders error message when error is set", () => {
    useAddressesList.mockReturnValue({
      addresses: [],
      error: "Network error",
      isLoading: false,
      refetch,
    });
    render(<AddressesSection />);
    expect(screen.getByText("Não foi possível carregar os endereços.")).toBeInTheDocument();
  });

  it("renders empty state and Adicionar endereço button when no addresses", () => {
    render(<AddressesSection />);
    expect(screen.getByText("Endereços")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar endereço/ })).toBeInTheDocument();
    expect(screen.getByText(/Nenhum endereço cadastrado/)).toBeInTheDocument();
  });

  it("renders address cards when addresses exist", () => {
    const addresses = [mockAddress({ id: "addr-1", street: "Rua A" })];
    useAddressesList.mockReturnValue({
      addresses,
      error: null,
      isLoading: false,
      refetch,
    });
    render(<AddressesSection />);
    expect(screen.getByText(/Rua A/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar endereço/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir endereço/ })).toBeInTheDocument();
  });

  it("opens add dialog when Adicionar endereço is clicked", () => {
    render(<AddressesSection />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar endereço/ }));
    expect(screen.getByTestId("address-form-dialog")).toBeInTheDocument();
  });

  it("opens delete dialog when Excluir is clicked on a card and confirms", () => {
    const addresses = [mockAddress({ id: "addr-1" })];
    useAddressesList.mockReturnValue({
      addresses,
      error: null,
      isLoading: false,
      refetch,
    });
    render(<AddressesSection />);
    fireEvent.click(screen.getByRole("button", { name: /Excluir endereço/ }));
    expect(screen.getByTestId("delete-address-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(deleteAddressMutation).toHaveBeenCalledWith("addr-1");
  });

  it("accepts custom cardHeaderClassName and titleSize", () => {
    render(<AddressesSection cardHeaderClassName="custom-header" titleSize="default" />);
    expect(screen.getByText("Endereços")).toBeInTheDocument();
  });
});
