import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Tables } from "@/lib/supabase/database.types";
import { PROVIDER_PORTFOLIO_IMAGE_SIGNED_URL_EXPIRY_SEC } from "../constants";

export type ProviderPortfolioItem = Tables<"provider_portfolio_items">;

export interface CreatePortfolioItemParams {
  id?: string;
  title: string;
  description?: string | null;
  service_id?: string | null;
  execution_date?: string | null;
  image_paths?: string[];
  city_region?: string | null;
  visibility?: "public" | "private";
  featured?: boolean;
  sort_order?: number;
}

export type UpdatePortfolioItemParams = Partial<CreatePortfolioItemParams>;

export async function listPortfolioItems(providerId: string): Promise<{
  items: ProviderPortfolioItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("provider_portfolio_items")
    .select("*")
    .eq("provider_id", providerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("provider_portfolio_list_error", {
      error: error.message,
      providerId,
    });
    return { items: [], error: error.message };
  }
  return { items: (data ?? []) as ProviderPortfolioItem[], error: null };
}

export async function createPortfolioItem(
  providerId: string,
  params: CreatePortfolioItemParams
): Promise<{ data: ProviderPortfolioItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from("provider_portfolio_items")
    .insert({
      id: params.id ?? undefined,
      provider_id: providerId,
      title: params.title,
      description: params.description ?? null,
      service_id: params.service_id ?? null,
      execution_date: params.execution_date ?? null,
      image_paths: params.image_paths ?? [],
      city_region: params.city_region ?? null,
      visibility: params.visibility ?? "public",
      featured: params.featured ?? false,
      sort_order: params.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    logger.error("provider_portfolio_create_error", {
      error: error.message,
      providerId,
    });
    return { data: null, error: error.message };
  }
  return { data: data as ProviderPortfolioItem, error: null };
}

export async function updatePortfolioItem(
  itemId: string,
  providerId: string,
  params: Partial<UpdatePortfolioItemParams>
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { ...params };
  delete payload.provider_id;
  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase
    .from("provider_portfolio_items")
    .update(payload)
    .eq("id", itemId)
    .eq("provider_id", providerId);

  if (error) {
    logger.error("provider_portfolio_update_error", {
      error: error.message,
      providerId,
      itemId,
    });
    return { error: error.message };
  }
  return { error: null };
}

export async function deletePortfolioItem(
  itemId: string,
  providerId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("provider_portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("provider_id", providerId);

  if (error) {
    logger.error("provider_portfolio_delete_error", {
      error: error.message,
      providerId,
      itemId,
    });
    return { error: error.message };
  }
  return { error: null };
}

export async function reorderPortfolioItems(
  providerId: string,
  itemIds: string[]
): Promise<{ error: string | null }> {
  const results = await Promise.all(
    itemIds.map((id, i) =>
      supabase
        .from("provider_portfolio_items")
        .update({ sort_order: i })
        .eq("id", id)
        .eq("provider_id", providerId)
    )
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    logger.error("provider_portfolio_reorder_error", {
      error: firstError.message,
      providerId,
    });
    return { error: firstError.message };
  }
  return { error: null };
}

/**
 * Returns a signed URL for a portfolio image storage path. Empty string on error.
 */
export async function getPortfolioImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("provider-portfolio-images")
    .createSignedUrl(path, PROVIDER_PORTFOLIO_IMAGE_SIGNED_URL_EXPIRY_SEC);
  if (error) return "";
  return data?.signedUrl ?? "";
}
