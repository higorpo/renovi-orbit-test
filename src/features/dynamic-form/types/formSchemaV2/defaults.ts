/**
 * Default values and constants for FormSchema V2.
 */

import type {
  SelectOption,
  FormSchemaMetadata,
  FormSchemaConfig,
  FormSchemaV2,
} from "./types";

export const DEFAULT_PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { value: "house", label: "Casa", emoji: "🏠", description: "Casa térrea ou sobrado" },
  { value: "apartment", label: "Apartamento", emoji: "🏢", description: "Unidade em condomínio" },
  { value: "commercial", label: "Comercial", emoji: "🏪", description: "Loja, escritório ou sala" },
  { value: "condo", label: "Condomínio", emoji: "🏘️", description: "Área comum de condomínio" },
];

export const DEFAULT_URGENCY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Sem pressa", emoji: "🟢", description: "Pode esperar algumas semanas" },
  { value: "medium", label: "Normal", emoji: "🟡", description: "Nos próximos dias" },
  { value: "high", label: "Urgente", emoji: "🟠", description: "O mais rápido possível" },
  { value: "urgent", label: "Emergência", emoji: "🔴", description: "Preciso hoje!" },
];

export const DEFAULT_METADATA: FormSchemaMetadata = {
  categorySlug: "",
  categoryId: null,
  status: "draft",
  minEngineVersion: "2.0.0",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  description: "",
  tags: [],
  schemaVersion: "1.0.0",
};

export const DEFAULT_CONFIG: FormSchemaConfig = {
  showProgressBar: true,
};

export function normalizeSchemaV2(
  schema: Partial<FormSchemaV2> | Record<string, unknown>,
  categorySlug: string,
  categoryId?: string | null,
  formStatus: "draft" | "active" | "deprecated" = "draft"
): FormSchemaV2 {
  if (!schema || typeof schema !== "object") {
    throw new Error("Schema must be an object");
  }
  if (schema.version !== "2.0") {
    throw new Error(`Schema version must be "2.0", received: "${schema.version}"`);
  }
  const existingMetadata = schema.metadata as Partial<FormSchemaMetadata> | undefined;
  const metadata: FormSchemaMetadata = {
    ...DEFAULT_METADATA,
    ...(existingMetadata || {}),
    categorySlug: existingMetadata?.categorySlug || categorySlug,
    categoryId: existingMetadata?.categoryId ?? categoryId ?? null,
    status: existingMetadata?.status || formStatus,
    updatedAt: new Date().toISOString(),
  };
  const existingConfig = schema.config as Partial<FormSchemaConfig> | undefined;
  const config: FormSchemaConfig = {
    ...DEFAULT_CONFIG,
    ...(existingConfig || {}),
  };
  return {
    version: "2.0",
    id: (schema.id as string) || `form_${Date.now()}`,
    title: (schema.title as string) || "Formulário",
    description: schema.description as string | undefined,
    metadata,
    config,
    steps: (schema.steps as FormSchemaV2["steps"]) || [],
  };
}
