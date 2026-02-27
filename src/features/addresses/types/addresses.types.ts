import type { Tables } from "@/lib/supabase/database.types";

export type ClientAddress = Tables<"client_addresses">;

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
