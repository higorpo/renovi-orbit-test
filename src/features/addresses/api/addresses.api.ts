import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ClientAddress,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
} from "../types/addresses.types";

export type {
  ClientAddress,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
} from "../types/addresses.types";

export async function listAddresses(clientId: string): Promise<ListAddressesResult> {
  const { data, error } = await supabase
    .from("client_addresses")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("addresses_list_error", { clientId, error: error.message });
    return { addresses: [], error: error.message };
  }
  return { addresses: (data ?? []) as ClientAddress[], error: null };
}

export async function createAddress(params: CreateAddressParams): Promise<CreateAddressResult> {
  const { data, error } = await supabase
    .from("client_addresses")
    .insert({
      client_id: params.client_id,
      label: params.label ?? "Casa",
      street: params.street,
      number: params.number,
      complement: params.complement ?? null,
      neighborhood: params.neighborhood,
      city: params.city,
      state: params.state,
      zip_code: params.zip_code,
      is_default: params.is_default ?? false,
      is_active: params.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    logger.error("addresses_create_error", { clientId: params.client_id, error: error.message });
    return { address: null, error: error.message };
  }
  return { address: data as ClientAddress, error: null };
}

export async function updateAddress(
  addressId: string,
  clientId: string,
  params: UpdateAddressParams
): Promise<UpdateAddressResult> {
  const { error } = await supabase
    .from("client_addresses")
    .update(params)
    .eq("id", addressId)
    .eq("client_id", clientId);

  if (error) {
    logger.error("addresses_update_error", { addressId, error: error.message });
    return { error: error.message };
  }
  return { error: null };
}
