export interface AddressFormDataLike {
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_state?: string;
  address_city?: string;
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
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface AddressPayloadExisting {
  kind: "existing";
  addressId: string;
  city: string;
  neighborhood: string;
}

export type AddressPayload = AddressPayloadNew | AddressPayloadExisting;

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
}

export interface CreateOrderSuccess {
  requestId: string;
  addressId: string;
}
