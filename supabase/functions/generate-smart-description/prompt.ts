import type { PromptConfig } from "./types.ts";
import { CACHE_TTL_MS } from "./constants.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Database } from "../_shared/database.types.ts";

const promptCache: Map<string, { data: PromptConfig; timestamp: number }> =
  new Map();

export async function getPromptFromDB(
  supabase: SupabaseClient<Database>,
  promptKey: string
): Promise<PromptConfig | null> {
  const cached = promptCache.get(promptKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Prompt] Cache hit for: ${promptKey}`);
    return cached.data;
  }

  console.log(`[Prompt] Fetching from DB: ${promptKey}`);

  try {
    const { data, error } = await supabase.rpc("get_prompt_by_key", {
      p_prompt_key: promptKey,
    });

    if (error) {
      console.error(`[Prompt] RPC error:`, error);
      return null;
    }

    if (data) {
      const promptConfig = data as unknown as PromptConfig;

      const normalizedData = {
        ...promptConfig,
        formatting_rules: {
          use_caps_titles: true,
          use_block_separation: true,
          allow_markdown: false,
          word_limit: 300,
          ...(typeof promptConfig.formatting_rules === "object"
            ? promptConfig.formatting_rules
            : {}),
        },
      };
      promptCache.set(promptKey, {
        data: normalizedData,
        timestamp: Date.now(),
      });
      console.log(
        `[Prompt] Cached: ${promptKey} (v${normalizedData.version})`
      );
      return normalizedData;
    }

    return null;
  } catch (err) {
    console.error(`[Prompt] Exception:`, err);
    return null;
  }
}

export async function getPromptById(
  supabase: SupabaseClient<Database>,
  promptId: string
): Promise<PromptConfig | null> {
  const cacheKey = `id:${promptId}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Prompt] Cache hit for id: ${promptId}`);
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from("ai_prompts")
      .select("*")
      .eq("id", promptId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error(`[Prompt] Fetch by id error:`, error);
      return null;
    }

    const normalizedData: PromptConfig = {
      ...data,
      formatting_rules: {
        use_caps_titles: true,
        use_block_separation: true,
        allow_markdown: false,
        ...(typeof data.formatting_rules === "object" && data.formatting_rules
          ? (data.formatting_rules as object)
          : {}),
      },
    };
    promptCache.set(cacheKey, {
      data: normalizedData,
      timestamp: Date.now(),
    });
    console.log(
      `[Prompt] Cached by id: ${promptId} (${normalizedData.prompt_key} v${normalizedData.version})`
    );
    return normalizedData;
  } catch (err) {
    console.error(`[Prompt] Exception getPromptById:`, err);
    return null;
  }
}
