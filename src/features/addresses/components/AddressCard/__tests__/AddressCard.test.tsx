import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressCard } from "../AddressCard";
import type { ClientAddressWithRelations } from "../../../types/addresses.types";

function mockAddress(overrides: Partial<ClientAddressWithRelations> = {}): ClientAddressWithRelations {
  return {
    id: "addr-1",
    client_id: "user-1",
    label: "Casa",
    street: "Rua das Flores",
    number: "100",
    complement: "Sala 2",
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

describe("AddressCard", () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onSetDefault = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders address line and city/state", () => {
    const address = mockAddress();
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.getByText(/Rua das Flores, 100, Sala 2, Centro, 01310100/)).toBeInTheDocument();
    expect(screen.getByText("São Paulo - SP")).toBeInTheDocument();
  });

  it("renders label when present", () => {
    const address = mockAddress({ label: "Trabalho" });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.getByText("Trabalho")).toBeInTheDocument();
  });

  it("renders Padrão badge when address is default", () => {
    const address = mockAddress({ is_default: true });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.getByText("Padrão")).toBeInTheDocument();
  });

  it("renders Padrão badge without label when is_default and no label", () => {
    const address = mockAddress({ label: undefined, is_default: true });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.getByText("Padrão")).toBeInTheDocument();
  });

  it("calls onEdit when Editar button is clicked", () => {
    const address = mockAddress();
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Editar endereço/ }));
    expect(onEdit).toHaveBeenCalledWith("addr-1");
  });

  it("calls onDelete when Excluir button is clicked", () => {
    const address = mockAddress();
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Excluir endereço/ }));
    expect(onDelete).toHaveBeenCalledWith("addr-1");
  });

  it("shows Definir como padrão button when not default and calls onSetDefault", () => {
    const address = mockAddress({ is_default: false });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    const setDefaultBtn = screen.getByRole("button", { name: /Definir como padrão/ });
    fireEvent.click(setDefaultBtn);
    expect(onSetDefault).toHaveBeenCalledWith("addr-1");
  });

  it("does not show Definir como padrão button when address is default", () => {
    const address = mockAddress({ is_default: true });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.queryByRole("button", { name: /Definir como padrão/ })).not.toBeInTheDocument();
  });

  it("disables Excluir button when isDeleting is true", () => {
    const address = mockAddress();
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
        isDeleting
      />
    );
    expect(screen.getByRole("button", { name: /Excluir endereço/ })).toBeDisabled();
  });

  it("disables Definir como padrão button when isSettingDefault is true", () => {
    const address = mockAddress({ is_default: false });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
        isSettingDefault
      />
    );
    expect(screen.getByRole("button", { name: /Definir como padrão/ })).toBeDisabled();
  });

  it("omits complement and city/state when null", () => {
    const address = mockAddress({
      complement: null,
      platform_cities: null,
      platform_states: null,
    });
    render(
      <AddressCard
        address={address}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    );
    expect(screen.getByText(/Rua das Flores, 100, Centro, 01310100/)).toBeInTheDocument();
  });
});
