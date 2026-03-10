import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Database } from "../_shared/database.types.ts";
import type { AddressPayloadNew } from "./types.ts";

export type CreateAddressResult =
  | { ok: true; addressId: string; city: string; neighborhood: string }
  | { ok: false; error: string };

function toRow(clientId: string, payload: AddressPayloadNew) {
  const f = payload.formData;
  const street = f?.address_street ?? payload.street ?? "";
  const number = f?.address_number ?? payload.number ?? "";
  const complement = f?.address_complement ?? payload.complement ?? null;
  const neighborhood = f?.address_neighborhood ?? payload.neighborhood ?? "";
  const city = f?.address_city ?? payload.city ?? "";
  const state = f?.address_state ?? payload.state ?? "";
  const zipRaw = f?.address_zip ?? payload.zip_code ?? "";
  const zip_code = zipRaw.replace(/\D/g, "").slice(0, 8) || zipRaw;

  return {
    client_id: clientId,
    label: payload.label ?? "Casa",
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    zip_code,
    is_default: payload.is_default ?? false,
    is_active: true,
  };
}

export async function createAddress(
  supabaseUrl: string,
  supabaseKey: string,
  clientId: string,
  payload: AddressPayloadNew
): Promise<CreateAddressResult> {
  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("client_addresses")
    .insert(toRow(clientId, payload))
    .select("id, city, neighborhood")
    .single();

  if (error) {
    console.error("[createAddress]", error.message);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    addressId: data.id,
    city: data.city,
    neighborhood: data.neighborhood,
  };
}
