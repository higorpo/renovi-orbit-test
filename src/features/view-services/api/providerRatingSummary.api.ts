import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export interface ProviderRatingSummary {
  providerId: string;
  ratingAvg: number | null;
  ratingCount: number;
}

function parseRatingSummary(row: unknown): ProviderRatingSummary | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const providerId = record.provider_id;
  if (typeof providerId !== "string" || !providerId) return null;

  const ratingCount = Number(record.rating_count) || 0;
  const rawAvg = record.rating_avg;
  const parsedAvg =
    typeof rawAvg === "number"
      ? rawAvg
      : typeof rawAvg === "string"
        ? Number(rawAvg)
        : NaN;
  const ratingAvg =
    ratingCount > 0 && Number.isFinite(parsedAvg) ? parsedAvg : null;

  return { providerId, ratingAvg, ratingCount };
}

export async function getProviderRatingSummary(
  providerId: string,
): Promise<{ summary: ProviderRatingSummary | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_provider_rating_summaries", {
    p_provider_ids: [providerId],
  });

  if (error) {
    logger.error("get_provider_rating_summary_error", {
      error: error.message,
      providerId,
    });
    return { summary: null, error: error.message };
  }

  const rows = Array.isArray(data) ? data : [];
  const summary = parseRatingSummary(rows[0]) ?? {
    providerId,
    ratingAvg: null,
    ratingCount: 0,
  };

  return { summary, error: null };
}
