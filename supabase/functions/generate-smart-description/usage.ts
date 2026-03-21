import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export async function logPromptUsage(
  supabase: SupabaseClient,
  promptId: string,
  userId: string | null,
  requestId: string | null,
  success: boolean,
  tokensUsed?: number,
  generationTimeMs?: number,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from("platform_ai_prompt_usage").insert({
      prompt_id: promptId,
      user_id: userId,
      request_id: requestId,
      tokens_used: tokensUsed,
      generation_time_ms: generationTimeMs,
      success,
      error_message: errorMessage,
      session_id: crypto.randomUUID(),
    });
    console.log(
      `[Usage] Logged: prompt=${promptId}, success=${success}, tokens=${tokensUsed}`
    );
  } catch (err) {
    console.warn("[Usage Log] Failed to log:", err);
  }
}
