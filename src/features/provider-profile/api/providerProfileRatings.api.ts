import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ProviderPublicRatingCursor,
  ProviderPublicRatingsPage,
} from "../types/providerProfilePublic.types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface ListPublicProviderRatingsParams {
  providerId: string;
  pageSize?: number;
  cursor?: ProviderPublicRatingCursor | null;
}

export interface ListPublicProviderRatingsResult {
  data: ProviderPublicRatingsPage | null;
  error: string | null;
}

function clampPageSize(pageSize: number | undefined): number {
  if (pageSize == null || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE);
}

function emptyPage(): ProviderPublicRatingsPage {
  return { items: [], next_cursor: null, has_more: false };
}

function parseRatingsPage(raw: unknown): ProviderPublicRatingsPage {
  if (raw == null || typeof raw !== "object") {
    return emptyPage();
  }

  const record = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const items = itemsRaw.flatMap((item) => {
    if (item == null || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.submitted_at !== "string") {
      return [];
    }
    const score = Number(row.overall_score);
    if (!Number.isFinite(score)) return [];
    return [
      {
        id: row.id,
        overall_score: score,
        comment:
          typeof row.comment === "string" && row.comment.trim()
            ? row.comment.trim()
            : null,
        submitted_at: row.submitted_at,
      },
    ];
  });

  let next_cursor: ProviderPublicRatingCursor | null = null;
  const cursorRaw = record.next_cursor;
  if (cursorRaw != null && typeof cursorRaw === "object") {
    const cursor = cursorRaw as Record<string, unknown>;
    if (
      typeof cursor.submitted_at === "string" &&
      typeof cursor.id === "string"
    ) {
      next_cursor = { submitted_at: cursor.submitted_at, id: cursor.id };
    }
  }

  return {
    items,
    next_cursor,
    has_more: Boolean(record.has_more) && next_cursor != null,
  };
}

/**
 * Cursor-paginated public provider ratings (no client PII).
 * Returns an empty page when the profile is not visible to the caller.
 */
export async function listPublicProviderRatings(
  params: ListPublicProviderRatingsParams,
): Promise<ListPublicProviderRatingsResult> {
  const providerId = params.providerId?.trim();
  if (!providerId) {
    return { data: null, error: "Provider id is required" };
  }

  const pageSize = clampPageSize(params.pageSize);
  const cursor = params.cursor ?? null;

  const { data, error } = await supabase.rpc("list_public_provider_ratings", {
    p_provider_id: providerId,
    p_page_size: pageSize,
    p_cursor_submitted_at: cursor?.submitted_at ?? undefined,
    p_cursor_id: cursor?.id ?? undefined,
  });

  if (error) {
    logger.error("list_public_provider_ratings_error", {
      error: error.message,
      providerId,
    });
    return { data: null, error: error.message };
  }

  // RPC returns null when profile is not visible to the caller.
  if (data == null) {
    return { data: emptyPage(), error: null };
  }

  return { data: parseRatingsPage(data), error: null };
}
