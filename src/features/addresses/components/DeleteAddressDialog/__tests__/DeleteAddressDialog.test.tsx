import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteAddressDialog } from "../DeleteAddressDialog";
import type { ClientAddressWithRelations } from "../../../types/addresses.types";

function mockAddress(overrides: Partial<ClientAddressWithRelations> = {}): ClientAddressWithRelations {
  return {
    id: "addr-1",
    client_id: "user-1",
    label: "Casa",
    street: "Rua das Flores",
    number: "100",
    complement: null,
    neighborhood: "Centro",
    city_id: "city-1",
    state_id: "state-1",
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

describe("DeleteAddressDialog", () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and description with address line when open and address provided", () => {
    const address = mockAddress();
    render(
      <DeleteAddressDialog
        open
        address={address}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole("heading", { name: /Excluir endereço/ })).toBeInTheDocument();
    expect(
      screen.getByText(/O endereço "Rua das Flores, 100, Centro" será removido/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir/ })).toBeInTheDocument();
  });

  it("renders description without quoted line when address is null", () => {
    render(
      <DeleteAddressDialog open address={null} onClose={onClose} onConfirm={onConfirm} />
    );
    expect(screen.getByText(/será removido da sua lista/)).toBeInTheDocument();
  });

  it("calls onConfirm and onClose when Excluir is clicked", () => {
    const address = mockAddress();
    render(
      <DeleteAddressDialog
        open
        address={address}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/ }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancelar is clicked", () => {
    const address = mockAddress();
    render(
      <DeleteAddressDialog
        open
        address={address}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
