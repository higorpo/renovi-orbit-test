import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";

export async function getPlatformConstantInt(
  key: string,
  defaultValue: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("platform_constant_int", {
    p_key: key,
    p_default: defaultValue,
  });

  if (error) {
    logger.warn("platform_constant_int_failed", { key, message: error.message });
    return defaultValue;
  }

  if (typeof data !== "number" || !Number.isFinite(data)) {
    logger.warn("platform_constant_int_invalid", { key, data });
    return defaultValue;
  }

  return data;
}

export async function getPlatformConstantBool(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("platform_constant_bool", {
    p_key: key,
    p_default: defaultValue,
  });

  if (error) {
    logger.warn("platform_constant_bool_failed", { key, message: error.message });
    return defaultValue;
  }

  if (typeof data !== "boolean") {
    logger.warn("platform_constant_bool_invalid", { key, data });
    return defaultValue;
  }

  return data;
}
