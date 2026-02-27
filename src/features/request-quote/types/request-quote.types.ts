import type { FormSchema } from "@/features/dynamic-form";
import type { Tables } from "@/lib/supabase/database.types";

export type Service = Tables<"services">;
export type ServiceRow = Service;
export type FormRow = Tables<"forms">;
export type ServiceRequestRow = Tables<"service_requests">;
export type ClientAddressRow = Tables<"client_addresses">;

export interface ServiceWithChildren extends Service {
  children?: ServiceWithChildren[];
}

export interface ServiceSchemaResult {
  schema: FormSchema | null;
  fallbackReason: string | null;
  isLoading: boolean;
}

export interface GenerateSmartDescriptionPayload {
  serviceId: string;
  formData: Record<string, unknown>;
  mode: "full_description";
  useStructuredOutput: boolean;
  /** Optional: notes for the AI context (e.g. step 3 description). */
  userNotes?: string | null;
  /** Optional: when set, edge function can persist AI result to this service_requests row. */
  requestId?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  state?: string | null;
}

export interface GenerateSmartDescriptionResponse {
  description?: string;
}
