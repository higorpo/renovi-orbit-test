export interface AddressFormDataLike {
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_state_id?: string;
  address_city_id?: string;
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
}

export interface AddressPayloadExisting {
  kind: "existing";
  addressId: string;
}

export type AddressPayload = AddressPayloadNew | AddressPayloadExisting;

/** Structured AI fields from generate-smart-description (subset saved on service_requests). */
export interface StructuredDataPayload {
  urgency?: "low" | "medium" | "high" | null;
  scope_complexity?: "simple" | "medium" | "complex" | null;
  suggested_questions?: string[] | null;
  tags?: string[] | null;
  missing_info_warnings?: string[] | null;
}

export interface ParsedFormData {
  userId: string;
  email: string;
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
