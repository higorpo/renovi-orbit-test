import { supabase } from "@/lib/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { latLngToH3Index } from "../utils/h3";
import type {
  ClientAddress,
  ClientAddressWithRelations,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
} from "../types/addresses.types";

export type {
  ClientAddress,
  ClientAddressWithRelations,
  ListAddressesResult,
  CreateAddressParams,
  CreateAddressResult,
  UpdateAddressParams,
  UpdateAddressResult,
} from "../types/addresses.types";

export async function listAddresses(clientId: string): Promise<ListAddressesResult> {
  const { data, error } = await supabase
    .from("client_addresses")
    .select("*, platform_cities(name), platform_states(abbreviation)")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("addresses_list_error", { clientId, error: error.message });
    return { addresses: [], error: error.message };
  }
  return { addresses: (data ?? []) as ClientAddressWithRelations[], error: null };
}

/** Build PostGIS geography from WGS84 lat/lng for client_addresses.location. */
function buildLocationEwkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

/** Ensure only one address per client is default: clear is_default on others. */
async function clearOtherDefaults(clientId: string, exceptAddressId?: string): Promise<{ error: string | null }> {
  let query = supabase
    .from("client_addresses")
    .update({ is_default: false })
    .eq("client_id", clientId);
  if (exceptAddressId) {
    query = query.neq("id", exceptAddressId);
  }
  const { error } = await query;
  if (error) return { error: error.message };
  return { error: null };
}

export async function createAddress(params: CreateAddressParams): Promise<CreateAddressResult> {
  const hasLocation =
    params.latitude != null &&
    params.longitude != null &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude);

  const setAsDefault = params.is_default ?? false;
  if (setAsDefault) {
    const cleared = await clearOtherDefaults(params.client_id);
    if (cleared.error) {
      logger.error("addresses_create_clear_defaults_error", {
        clientId: params.client_id,
        error: cleared.error,
      });
      return { address: null, error: cleared.error };
    }
  }

  const h3_index = hasLocation
    ? latLngToH3Index(params.latitude!, params.longitude!)
    : null;

  const row: TablesInsert<"client_addresses"> = {
    client_id: params.client_id,
    label: params.label ?? "Casa",
    street: params.street,
    number: params.number,
    complement: params.complement ?? null,
    neighborhood: params.neighborhood,
    city_id: params.city_id,
    state_id: params.state_id,
    zip_code: params.zip_code,
    is_default: setAsDefault,
    is_active: params.is_active ?? true,
    ...(hasLocation && {
      location: buildLocationEwkt(params.latitude!, params.longitude!),
    }),
    ...(h3_index && { h3_index }),
  };

  const { data, error } = await supabase
    .from("client_addresses")
    .insert(row)
    .select()
    .single();

  if (error) {
    logger.error("addresses_create_error", { clientId: params.client_id, error: error.message });
    return { address: null, error: error.message };
  }
  metrics.count("addresses.created", 1);
  return { address: data as ClientAddress, error: null };
}

export async function updateAddress(
  addressId: string,
  clientId: string,
  params: UpdateAddressParams
): Promise<UpdateAddressResult> {
  const hasLocation =
    params.latitude != null &&
    params.longitude != null &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude);

  if (params.is_default === true) {
    const cleared = await clearOtherDefaults(clientId, addressId);
    if (cleared.error) {
      logger.error("addresses_update_clear_defaults_error", {
        addressId,
        clientId,
        error: cleared.error,
      });
      return { error: cleared.error };
    }
  }

  const { latitude: _lat, longitude: _lng, ...rest } = params;
  const h3_index = hasLocation
    ? latLngToH3Index(params.latitude!, params.longitude!)
    : undefined;

  const updatePayload: TablesUpdate<"client_addresses"> = {
    ...rest,
    ...(hasLocation && {
      location: buildLocationEwkt(params.latitude!, params.longitude!),
    }),
    ...(h3_index !== undefined && { h3_index: h3_index ?? null }),
  };

  const { error } = await supabase
    .from("client_addresses")
    .update(updatePayload)
    .eq("id", addressId)
    .eq("client_id", clientId);

  if (error) {
    logger.error("addresses_update_error", { addressId, error: error.message });
    return { error: error.message };
  }
  metrics.count("addresses.updated", 1);
  return { error: null };
}

export interface DeleteAddressResult {
  error: string | null;
}

/** Soft-delete: sets is_active = false so the address no longer appears in listAddresses. */
export async function deleteAddress(
  addressId: string,
  clientId: string
): Promise<DeleteAddressResult> {
  return updateAddress(addressId, clientId, { is_active: false });
}
