import type {
  EstimatedDurationHintKey,
  SuggestedEquipmentKey,
  SuggestedMaterialsKey,
} from "./allowedValues.ts";

/** Mode for AI output: full description (structured or plain) or short suggestion only. */
export type SmartDescriptionMode = "full_description" | "suggestion";

/** AI provider: OpenAI (default) or Google Gemini. */
export type SmartDescriptionProvider = "openai" | "gemini";

/**
 * Structured AI response (phase 3) with professional_description, tags, metadata.
 */
export interface StructuredAIResponse {
  schema_version: number;
  professional_description: string;
  suggested_title: string;
  tags: string[];
  missing_info_warnings: string[];
  urgency: "low" | "medium" | "high";
  scope_complexity: "simple" | "medium" | "complex";
  confidence: number;
  recommended_next_step: "ask_questions" | "schedule_visit" | "send_estimate_range";
  suggested_equipment: SuggestedEquipmentKey[];
  suggested_materials: SuggestedMaterialsKey[];
  estimated_duration_hint: EstimatedDurationHintKey | null;
}

/**
 * Request body for the generate-smart-description edge function.
 */
export interface GenerateSmartDescriptionBody {
  /** Service UUID (required). Used to resolve ai_prompt_id and display name. */
  serviceId?: string;
  /** Form fields to build the AI context. */
  formData?: Record<string, unknown>;
  /** Free-text notes from the client (e.g. step 3). */
  userNotes?: string;
  /** Optional service_request UUID to persist AI metadata and description. */
  serviceRequestId?: string | null;
  /** Override prompt via key (e.g. admin/test). */
  forcePromptKey?: string | null;
  /** When false, disables structured JSON output. Default true. */
  useStructuredOutput?: boolean;
  /** "full_description" (default) or "suggestion" (short "Detalhes Adicionais" only). */
  mode?: SmartDescriptionMode;
  /** Form schema (steps with blocks) so the AI gets field meanings (description_ai per block). */
  formSchema?: Record<string, unknown> | null;
  /** AI provider: "openai" (default) or "gemini". */
  provider?: SmartDescriptionProvider;
}
