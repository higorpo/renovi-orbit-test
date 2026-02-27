
/**
 * Prompt configuration from DB (ai_prompts or RPC get_prompt_by_key).
 */
export interface PromptConfig {
  id: string;
  prompt_key: string;
  name: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  formatting_rules: {
    use_caps_titles?: boolean;
    use_block_separation?: boolean;
    allow_markdown?: boolean;
  };
  version: number;
}

/**
 * Structured AI response (phase 3) with professional_description, tags, metadata.
 */
export interface StructuredAIResponse {
  schema_version: number;
  professional_description: string;
  tags: string[];
  missing_info_warnings: string[];
  suggested_questions: string[];
  urgency: "low" | "medium" | "high";
  scope_complexity: "simple" | "medium" | "complex";
  confidence: number;
  recommended_next_step: "ask_questions" | "schedule_visit" | "send_estimate_range";
}

/** Mode for AI output: full description (structured or plain) or short suggestion only. */
export type SmartDescriptionMode = "full_description" | "suggestion";


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
}

/**
 * Parameters for formatFormDataToContext.
 */
export interface FormatFormDataToContextParams {
  /** Display name of the service (e.g. from services.title or slug). */
  serviceName: string;
  /** Form fields to build the AI context. */
  formData: Record<string, unknown>;
  /** Free-text notes from the client. */
  userNotes?: string;
  /** When "suggestion", long strings are truncated to save tokens. */
  mode?: SmartDescriptionMode;
}

/** Parsed and normalized request params from the body. */
export interface ParsedRequestParams {
  serviceId: string;
  formData: Record<string, unknown>;
  userNotes: string;
  serviceRequestId: string | null;
  forcePromptKey: string | null;
  useStructuredOutput: boolean;
  mode: SmartDescriptionMode;
}

/** Result of resolving prompt config and service display name. */
export interface ResolvedPromptResult {
  promptConfig: PromptConfig;
  serviceDisplayName: string;
}

/** Result of processing the raw AI response. */
export interface ProcessedAIResult {
  processedDescription: string;
  structuredResponse: StructuredAIResponse | null;
}
