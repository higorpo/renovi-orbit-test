// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveAddress } from "../resolveAddress";
import * as addressesApi from "../../api/addresses.api";

vi.mock("../../api/addresses.api", () => ({
  createAddress: vi.fn(),
}));

const createAddress = vi.mocked(addressesApi.createAddress);

const validFormData = {
  address_label: "Casa",
  address_zip: "01310-100",
  address_street: "Avenida Paulista",
  address_number: "1000",
  address_complement: "",
  address_neighborhood_id: "11111111-1111-4111-8111-111111111111",
  address_neighborhood: "Bela Vista",
  address_state_id: "22222222-2222-4222-8222-222222222222",
  address_state: "SP",
  address_city_id: "33333333-3333-4333-8333-333333333333",
  address_city: "São Paulo",
};

describe("resolveAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when selection is null", async () => {
    const result = await resolveAddress("user-1", null, {
      defaultLabel: "Casa",
      isDefault: false,
    });
    expect(result).toEqual({
      ok: false,
      error: "Selecione um endereço ou cadastre um novo.",
    });
    expect(createAddress).not.toHaveBeenCalled();
  });

  it("returns ok with addressId when selection is existing", async () => {
    const result = await resolveAddress(
      "user-1",
      { kind: "existing", addressId: "addr-123" },
      { defaultLabel: "Casa", isDefault: false }
    );
    expect(result).toEqual({ ok: true, addressId: "addr-123" });
    expect(createAddress).not.toHaveBeenCalled();
  });

  it("returns validation error when new selection formData is invalid", async () => {
    const result = await resolveAddress(
      "user-1",
      {
        kind: "new",
        formData: {
          ...validFormData,
          address_zip: "invalid",
          address_street: "Ab",
          address_number: "",
          address_state_id: "not-uuid",
        },
      },
      { defaultLabel: "Casa", isDefault: false }
    );
    expect(result.ok).toBe(false);
    expect("error" in result && result.error.length).toBeGreaterThan(0);
    expect(createAddress).not.toHaveBeenCalled();
  });

  it("calls createAddress and returns ok when new address is created", async () => {
    createAddress.mockResolvedValue({
      address: { id: "new-addr-1" } as addressesApi.ClientAddress,
      error: null,
    });
    const result = await resolveAddress(
      "user-1",
      { kind: "new", formData: validFormData },
      { defaultLabel: "Trabalho", isDefault: true }
    );
    expect(result).toEqual({ ok: true, addressId: "new-addr-1" });
    expect(createAddress).toHaveBeenCalledTimes(1);
    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "user-1",
        label: "Trabalho",
        street: validFormData.address_street,
        number: validFormData.address_number,
        complement: null,
        neighborhood: validFormData.address_neighborhood,
        city_id: validFormData.address_city_id,
        state_id: validFormData.address_state_id,
        zip_code: "01310100",
        is_default: true,
        is_active: true,
      })
    );
  });

  it("returns error when createAddress fails", async () => {
    createAddress.mockResolvedValue({
      address: null,
      error: "Database error",
    });
    const result = await resolveAddress(
      "user-1",
      { kind: "new", formData: validFormData },
      { defaultLabel: "Casa", isDefault: false }
    );
    expect(result).toEqual({
      ok: false,
      error: "Erro ao salvar endereço. Tente novamente.",
    });
  });

  it("passes optional complement when present", async () => {
    createAddress.mockResolvedValue({
      address: { id: "new-addr-1" } as addressesApi.ClientAddress,
      error: null,
    });
    await resolveAddress(
      "user-1",
      {
        kind: "new",
        formData: { ...validFormData, address_complement: "Sala 101" },
      },
      { defaultLabel: "Casa", isDefault: false }
    );
    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        complement: "Sala 101",
      })
    );
  });
});
