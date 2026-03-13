import { useQuery } from "@tanstack/react-query";
import type { FormSchema } from "@/features/dynamic-form";
import { validateFormSchema } from "@/features/dynamic-form";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/supabase/database.types";
import { getServiceBySlug } from "../api/services.api";
import { getServiceById } from "../api/services.api";
import { getFormById } from "../api/forms.api";
import type { ServiceSchemaResult } from "../types/request-quote.types";

const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

function parseSchemaFromJson(json: Json | null): FormSchema | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (obj.version === "2.0" && Array.isArray(obj.steps)) {
    return obj as unknown as FormSchema;
  }
  return null;
}

export interface UseServiceSchemaParams {
  serviceSlug?: string | null;
  serviceId?: string | null;
}

/**
 * Fetches service (by slug or id), then its form, validates schema and returns
 * result for DynamicForm. No feature-flag; form_status must be 'active'.
 */
export function useServiceSchema(params: UseServiceSchemaParams): ServiceSchemaResult {
  const { serviceSlug, serviceId } = params;
  const bySlug = !!serviceSlug;
  const key = bySlug ? serviceSlug : serviceId;
  const enabled = !!(bySlug ? serviceSlug : serviceId);

  const { data: serviceData, isLoading: serviceLoading, error: serviceError } = useQuery({
    queryKey: ["request-quote-service", bySlug ? "slug" : "id", key],
    queryFn: async () => {
      if (bySlug && serviceSlug) return getServiceBySlug(serviceSlug);
      if (!bySlug && serviceId) return getServiceById(serviceId);
      return { service: null, error: "No slug or id" };
    },
    enabled,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  const service = serviceData?.service ?? null;
  const serviceErr = serviceData?.error ?? null;
  const formId = service?.form_id ?? null;

  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ["request-quote-form", formId],
    queryFn: () => getFormById(formId!),
    enabled: !!formId,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  const form = formData?.form ?? null;
  const isLoading = serviceLoading || (!!formId && formLoading);

  if (!enabled || !key) {
    return {
      schema: null,
      fallbackReason: "no_service_slug_or_id",
      isLoading: false,
    };
  }

  if (isLoading) {
    return {
      schema: null,
      fallbackReason: "loading",
      isLoading: true,
    };
  }

  if (serviceError || serviceErr) {
    const reason = `fetch_error: ${serviceErr ?? (serviceError as Error)?.message}`;
    logger.warn("request_quote_service_schema_fallback", {
      fallbackReason: reason,
      serviceSlug: serviceSlug ?? undefined,
      serviceId: serviceId ?? undefined,
    });
    return {
      schema: null,
      fallbackReason: reason,
      isLoading: false,
    };
  }

  if (!service) {
    logger.warn("request_quote_service_schema_fallback", {
      fallbackReason: "service_not_found",
      serviceSlug: serviceSlug ?? undefined,
      serviceId: serviceId ?? undefined,
    });
    return {
      schema: null,
      fallbackReason: "service_not_found",
      isLoading: false,
    };
  }

  if (!formId || !form) {
    logger.warn("request_quote_service_schema_fallback", {
      fallbackReason: "no_form",
      serviceId: service.id,
    });
    return {
      schema: null,
      fallbackReason: "no_form",
      isLoading: false,
    };
  }

  if (form.form_status !== "active") {
    logger.warn("request_quote_service_schema_fallback", {
      fallbackReason: `form_status_not_active: ${form.form_status}`,
      serviceId: service.id,
    });
    return {
      schema: null,
      fallbackReason: `form_status_not_active: ${form.form_status}`,
      isLoading: false,
    };
  }

  const parsedSchema = parseSchemaFromJson(form.form_schema);
  if (!parsedSchema) {
    logger.error("request_quote_service_schema_fallback", {
      fallbackReason: "no_v2_schema",
      formId: form.id,
      serviceId: service.id,
    });
    return {
      schema: null,
      fallbackReason: "no_v2_schema",
      isLoading: false,
    };
  }

  const validationResult = validateFormSchema(parsedSchema);
  if (!validationResult.valid) {
    logger.error("request_quote_service_schema_fallback", {
      fallbackReason: `schema_validation_failed: ${validationResult.errors.length} error(s)`,
      formId: form.id,
      serviceId: service.id,
    });
    return {
      schema: null,
      fallbackReason: `schema_validation_failed: ${validationResult.errors.length} error(s)`,
      isLoading: false,
    };
  }

  const slugForMetadata = service.slug ?? String(service.id);
  const schemaWithMetadata: FormSchema = {
    ...parsedSchema,
    metadata: {
      ...parsedSchema.metadata,
      categorySlug: parsedSchema.metadata?.categorySlug ?? slugForMetadata,
      categoryId: parsedSchema.metadata?.categoryId ?? service.id,
    },
  };

  return {
    schema: schemaWithMetadata,
    fallbackReason: null,
    isLoading: false,
  };
}
