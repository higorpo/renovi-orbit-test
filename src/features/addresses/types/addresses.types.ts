import type { Tables } from "@/lib/supabase/database.types";
import type { AddressFormData } from "./addressForm.validation";

export type ClientAddress = Tables<"client_addresses">;

/** Client address row with joined city/state names for display. */
export interface ClientAddressWithRelations extends ClientAddress {
  platform_cities: { name: string } | null;
  platform_states: { abbreviation: string } | null;
}
export type PlatformState = Tables<"platform_states">;
export type PlatformCity = Tables<"platform_cities">;
export type PlatformNeighborhood = Tables<"platform_neighborhoods">;

export interface ListAddressesResult {
  addresses: ClientAddressWithRelations[];
  error: string | null;
}

export interface CreateAddressParams {
  client_id: string;
  label?: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city_id: string;
  state_id: string;
  zip_code: string;
  is_default?: boolean;
  is_active?: boolean;
  /** WGS84 coordinates; when set, stored in client_addresses.location. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateAddressResult {
  address: ClientAddress | null;
  error: string | null;
}

export interface UpdateAddressParams {
  label?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city_id?: string;
  state_id?: string;
  zip_code?: string;
  is_default?: boolean;
  is_active?: boolean;
  /** WGS84 coordinates; when set, stored in client_addresses.location. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateAddressResult {
  error: string | null;
}

/** Payload when user selects an existing address. */
export interface AddressSelectionExisting {
  kind: "existing";
  addressId: string;
}

/** Coordinates for the address (from map or geocoding). Persisted as client_addresses.location. */
export interface AddressLocation {
  latitude: number;
  longitude: number;
}

/** Payload when user fills the new-address form. */
export interface AddressSelectionNew {
  kind: "new";
  formData: AddressFormData;
  /** Optional coordinates (WGS84) to persist on client_addresses.location. */
  location?: AddressLocation | null;
}

/** Selection state: existing address, new form data, or none. */
export type AddressSelection = AddressSelectionExisting | AddressSelectionNew | null;

export type ResolveAddressResult =
  | { ok: true; addressId: string | null; city?: string; neighborhood?: string }
  | { ok: false; error: string };
