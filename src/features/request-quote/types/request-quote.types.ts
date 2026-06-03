import type { FormSchema } from "@/features/dynamic-form";
import type { Tables } from "@/lib/supabase/database.types";
import type { GenerateSmartDescriptionBody, StructuredAIResponse } from "../../../../supabase/functions/generate-smart-description/types";

export type Service = Tables<"platform_services">;
export type ServiceRow = Service;
export type FormRow = Tables<"platform_forms">;
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
  description: string;
  suggestedTitle?: string;
  metadata: Record<string, unknown>;
  structured?: StructuredAIResponse;
}

/** Subset of StructuredAIResponse saved on service_requests and sent to create-request-quote-order. */
export type ServiceRequestStructuredData = Pick<
  StructuredAIResponse,
  | "urgency"
  | "scope_complexity"
  | "tags"
  | "missing_info_warnings"
  | "suggested_equipment"
  | "suggested_materials"
  | "estimated_duration_hint"
>;
