import { ESTIMATED_DURATION_HINT_KEYS } from "../generate-smart-description/allowedValues.ts";

export interface AddressFormDataLike {
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_state_id?: string;
  address_city_id?: string;
}

/** Coordinates for the address (from map or geocoding). Sent to backend to set client_addresses.location. */
export interface AddressLocationPayload {
  latitude: number;
  longitude: number;
}

export interface AddressPayloadNew {
  kind: "new";
  label?: string;
  is_default?: boolean;
  formData?: AddressFormDataLike;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city_id?: string;
  state_id?: string;
  zip_code?: string;
  /** Optional coordinates to set client_addresses.location (WGS84). */
  location?: AddressLocationPayload | null;
}

export interface AddressPayloadExisting {
  kind: "existing";
  addressId: string;
}

export type AddressPayload = AddressPayloadNew | AddressPayloadExisting;

/** Allowed values for estimated_duration_hint (must match generate-smart-description allowedValues). */
export const ESTIMATED_DURATION_HINT_VALUES = ESTIMATED_DURATION_HINT_KEYS;

/** Structured AI fields from generate-smart-description (subset saved on service_requests). */
export interface StructuredDataPayload {
  urgency?: "low" | "medium" | "high" | null;
  scope_complexity?: "simple" | "medium" | "complex" | null;
  suggested_questions?: string[] | null;
  tags?: string[] | null;
  missing_info_warnings?: string[] | null;
  suggested_equipment?: string[] | null;
  suggested_materials?: string[] | null;
  estimated_duration_hint?: string | null;
}

export interface ParsedFormData {
  userId: string;
  email: string;
  recaptchaToken: string;
  address: AddressPayload;
  serviceId: string;
  serviceTitle: string;
  description: string;
  formData: Record<string, unknown>;
  formSchema: Record<string, unknown> | null;
  formVersion: string | null;
  photoFiles: Blob[];
  structuredData?: StructuredDataPayload | null;
}

export interface CreateOrderSuccess {
  requestId: string;
  addressId: string;
}
