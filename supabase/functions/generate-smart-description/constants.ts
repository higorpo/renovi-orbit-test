export const CACHE_TTL_MS = 5 * 60 * 1000;
export const FORM_DATA_MAX_BYTES = 50_000;
export const SUGGESTION_TRUNCATE_CHARS = 500;
export const MAX_CONTEXT_DEPTH = 3;

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const OPEN_AI_DEFAULT_MODEL = "gpt-4o-mini";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite";
