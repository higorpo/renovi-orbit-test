import type { Tables } from "@/lib/supabase/database.types";
import type { AddressFormData } from "./addressForm.validation";

export type ClientAddress = Tables<"client_addresses">;
export type PlatformState = Tables<"platform_states">;
export type PlatformCity = Tables<"platform_cities">;
export type PlatformNeighborhood = Tables<"platform_neighborhoods">;

export interface ListAddressesResult {
  addresses: ClientAddress[];
  error: string | null;
}

export interface CreateAddressParams {
  client_id: string;
  label?: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default?: boolean;
  is_active?: boolean;
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
  city?: string;
  state?: string;
  zip_code?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export interface UpdateAddressResult {
  error: string | null;
}

/** Payload when user selects an existing address. */
export interface AddressSelectionExisting {
  kind: "existing";
  addressId: string;
  city: string;
  neighborhood: string;
  state: string;
}

/** Payload when user fills the new-address form. */
export interface AddressSelectionNew {
  kind: "new";
  formData: AddressFormData;
}

/** Selection state: existing address, new form data, or none. */
export type AddressSelection = AddressSelectionExisting | AddressSelectionNew | null;

export type ResolveAddressResult =
  | { ok: true; addressId: string | null; city: string; neighborhood: string }
  | { ok: false; error: string };
