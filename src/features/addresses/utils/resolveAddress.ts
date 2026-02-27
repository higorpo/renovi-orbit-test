import { createAddress } from "../api/addresses.api";
import { unmask } from "@/lib/masks";
import { addressFormSchema } from "../types/addressForm.validation";
import type { AddressSelection, ResolveAddressResult } from "../types/addresses.types";

export async function resolveAddress(
  userId: string,
  selection: AddressSelection,
  options: { defaultLabel: string; isDefault: boolean }
): Promise<ResolveAddressResult> {
  if (!selection) {
    return { ok: false, error: "Selecione um endereço ou cadastre um novo." };
  }
  if (selection.kind === "existing") {
    return {
      ok: true,
      addressId: selection.addressId,
      city: selection.city,
      neighborhood: selection.neighborhood,
    };
  }
  const parsed = addressFormSchema.safeParse(selection.formData);
  if (!parsed.success) {
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
    city: formData.address_city,
    state: formData.address_state,
    zip_code: cleanCep,
    is_default: options.isDefault,
    is_active: true,
  });
  if (addrErr) {
    return { ok: false, error: "Erro ao salvar endereço. Tente novamente." };
  }
  return {
    ok: true,
    addressId: newAddr?.id ?? null,
    city: formData.address_city,
    neighborhood: formData.address_neighborhood,
  };
}
