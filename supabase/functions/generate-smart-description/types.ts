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

export type {
  GenerateSmartDescriptionBody,
  SmartDescriptionMode,
  SmartDescriptionProvider,
  StructuredAIResponse,
} from "@orbit/contracts/generate-smart-description/types.ts";

import type {
  SmartDescriptionMode,
  SmartDescriptionProvider,
  StructuredAIResponse,
} from "@orbit/contracts/generate-smart-description/types.ts";

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
  /** Form schema (steps with blocks) to include field meanings (description_ai) in context. */
  formSchema?: Record<string, unknown> | null;
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
  formSchema: Record<string, unknown> | null;
  provider: SmartDescriptionProvider;
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
