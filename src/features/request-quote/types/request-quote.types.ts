import type { FormSchema } from "@/features/dynamic-form";
import type { Tables } from "@/lib/supabase/database.types";
import type { GenerateSmartDescriptionBody } from "../../../../supabase/functions/generate-smart-description/types";

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

export type GenerateSmartDescriptionPayload = GenerateSmartDescriptionBody

export interface GenerateSmartDescriptionResponse {
  description?: string;
}
