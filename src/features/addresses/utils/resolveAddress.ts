import { createAddress } from "../api/addresses.api";
import { unmask } from "@/lib/masks";
import { addBreadcrumb } from "@/lib/sentry";
import { addressFormSchema } from "../types/addressForm.validation";
import type { AddressSelection, ResolveAddressResult } from "../types/addresses.types";

export async function resolveAddress(
  userId: string,
  selection: AddressSelection,
  options: { defaultLabel: string; isDefault: boolean }
): Promise<ResolveAddressResult> {
  if (!selection) {
    addBreadcrumb({
      category: "address",
      message: "address.resolve_skipped",
      level: "warning",
      data: { reason: "no_selection" },
    });
    return { ok: false, error: "Selecione um endereço ou cadastre um novo." };
  }
  if (selection.kind === "existing") {
    return {
      ok: true,
      addressId: selection.addressId,
    };
  }
  const parsed = addressFormSchema.safeParse(selection.formData);
  if (!parsed.success) {
    addBreadcrumb({
      category: "address",
      message: "address.resolve_validation_failed",
      level: "warning",
      data: { userId },
    });
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const formData = parsed.data;
  const cleanCep = unmask(formData.address_zip);
  const { address: newAddr, error: addrErr } = await createAddress({
    client_id: userId,
    label: options.defaultLabel,
    street: formData.address_street,
    number: formData.address_number,
    complement: formData.address_complement || null,
    neighborhood: formData.address_neighborhood,
    city_id: formData.address_city_id,
    state_id: formData.address_state_id,
    zip_code: cleanCep,
    is_default: options.isDefault,
    is_active: true,
  });
  if (addrErr) {
    addBreadcrumb({
      category: "address",
      message: "address.resolve_create_failed",
      level: "error",
      data: { userId },
    });
    return { ok: false, error: "Erro ao salvar endereço. Tente novamente." };
  }
  addBreadcrumb({
    category: "address",
    message: "address.resolve_ok",
    data: { userId },
  });
  return {
    ok: true,
    addressId: newAddr?.id ?? null,
  };
}
