import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Tables } from "@/lib/supabase/database.types";
import { PROVIDER_PORTFOLIO_IMAGE_SIGNED_URL_EXPIRY_SEC } from "../constants";

export type ProviderPrivateProfile = Tables<"provider_profiles_private">;
export type ProviderPublicProfile = Tables<"provider_profiles_public">;
/** Public profile with service area neighborhood IDs and display fields derived from provider_service_area_neighborhoods. */
export type ProviderPublicProfileWithServiceArea = ProviderPublicProfile & {
  service_area_neighborhood_ids: string[];
  /** Derived from neighborhoods for form display. */
  service_area_city: string | null;
  service_area_regions: string[] | null;
  service_area_neighborhoods: string[] | null;
};
export type ProviderPortfolioItem = Tables<"provider_portfolio_items">;

export interface GetProviderPrivateResult {
  data: ProviderPrivateProfile | null;
  error: string | null;
}

export interface GetProviderPublicResult {
  data: ProviderPublicProfileWithServiceArea | null;
  error: string | null;
}

export interface UpdateProviderPrivateParams {
  entity_type?: "pf" | "pj";
  cpf?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  legal_representative_name?: string | null;
  legal_representative_cpf?: string | null;
  commercial_contact?: string | null;
}

export interface UpdateProviderPublicParams {
  slug?: string;
  display_name?: string | null;
  bio?: string | null;
  profile_visibility?: "public" | "restricted";
  /** Replaces provider_service_area_neighborhoods rows; display text is derived from platform data when reading. */
  service_area_neighborhood_ids?: string[] | null;
}

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

/** Normalize string to URL-safe slug: lowercase, hyphen, no accents. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "perfil";
}

export async function getProviderPrivateProfile(
  providerId: string
): Promise<GetProviderPrivateResult> {
  const { data, error } = await supabase
    .from("provider_profiles_private")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    logger.error("provider_private_profile_fetch_error", {
      error: error.message,
      providerId,
    });
    return { data: null, error: error.message };
  }
  return { data: data as ProviderPrivateProfile | null, error: null };
}

export async function updateProviderPrivateProfile(
  providerId: string,
  params: UpdateProviderPrivateParams
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { ...params };
  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase
    .from("provider_profiles_private")
    .upsert({ provider_id: providerId, ...payload }, { onConflict: "provider_id" });

  if (error) {
    logger.error("provider_private_profile_update_error", {
      error: error.message,
      providerId,
    });
    return { error: error.message };
  }
  return { error: null };
}

export async function getProviderPublicProfile(
  providerId: string
): Promise<GetProviderPublicResult> {
  const { data, error } = await supabase
    .from("provider_profiles_public")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    logger.error("provider_public_profile_fetch_error", {
      error: error.message,
      providerId,
    });
    return { data: null, error: error.message };
  }

  const { data: areaRows } = await supabase
    .from("provider_service_area_neighborhoods")
    .select("neighborhood_id")
    .eq("provider_id", providerId);

  const service_area_neighborhood_ids = (areaRows ?? []).map(
    (r: { neighborhood_id: string }) => r.neighborhood_id
  );

  let service_area_city: string | null = null;
  let service_area_regions: string[] | null = null;
  let service_area_neighborhoods: string[] | null = null;

  if (service_area_neighborhood_ids.length > 0) {
    const { data: neighborhoodRows } = await supabase
      .from("platform_neighborhoods")
      .select("name, platform_cities(name, platform_states(abbreviation))")
      .in("id", service_area_neighborhood_ids)
      .order("name", { ascending: true });

    const rows = (neighborhoodRows ?? []) as {
      name: string;
      platform_cities: { name: string; platform_states: { abbreviation: string } | null } | null;
    }[];
    service_area_neighborhoods = rows.map((r) => r.name);
    const cityNames = [...new Set(rows.map((r) => r.platform_cities?.name ?? "").filter(Boolean))];
    service_area_city = cityNames.length > 0 ? cityNames.join(", ") : null;
    const stateAbbrevs = [
      ...new Set(
        rows
          .map((r) => r.platform_cities?.platform_states?.abbreviation ?? "")
          .filter(Boolean)
      ),
    ];
    service_area_regions = stateAbbrevs.length > 0 ? stateAbbrevs : null;
  }

  return {
    data: data
      ? ({
          ...data,
          service_area_neighborhood_ids,
          service_area_city,
          service_area_regions,
          service_area_neighborhoods,
        } as ProviderPublicProfileWithServiceArea)
      : null,
    error: null,
  };
}

export async function updateProviderPublicProfile(
  providerId: string,
  params: UpdateProviderPublicParams
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = { ...params };
  delete payload.service_area_neighborhood_ids;

  // Only set slug from display_name when user sets it for the first time (current slug is still providerId)
  if (params.display_name !== undefined) {
    const { data: current } = await supabase
      .from("provider_profiles_public")
      .select("slug")
      .eq("provider_id", providerId)
      .maybeSingle();
    const currentSlug = current?.slug ?? null;
    if (currentSlug === providerId || currentSlug == null) {
      payload.slug = resolveUniqueSlug(providerId, params.display_name);
    }
  }

  if (params.service_area_neighborhood_ids != null) {
    const { error: deleteError } = await supabase
      .from("provider_service_area_neighborhoods")
      .delete()
      .eq("provider_id", providerId);

    if (deleteError) {
      logger.error("provider_service_area_neighborhoods_delete_error", {
        error: deleteError.message,
        providerId,
      });
      return { error: deleteError.message };
    }

    if (params.service_area_neighborhood_ids.length > 0) {
      const { error: insertError } = await supabase
        .from("provider_service_area_neighborhoods")
        .insert(
          params.service_area_neighborhood_ids.map((neighborhood_id) => ({
            provider_id: providerId,
            neighborhood_id,
          }))
        );

      if (insertError) {
        logger.error("provider_service_area_neighborhoods_insert_error", {
          error: insertError.message,
          providerId,
        });
        return { error: insertError.message };
      }
    }
  }

  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase
    .from("provider_profiles_public")
    .update(payload)
    .eq("provider_id", providerId);

  if (error) {
    logger.error("provider_public_profile_update_error", {
      error: error.message,
      providerId,
    });
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Generates a unique slug for a provider: display_name (slugified) plus a unique suffix
 * (timestamp + random) so we avoid database lookups for uniqueness.
 * When displayName is empty, uses providerId as base.
 */
function resolveUniqueSlug(
  providerId: string,
  displayName: string | null | undefined
): string {
  const trimmed = (displayName ?? "").trim();
  let baseSlug: string;
  if (!trimmed) {
    baseSlug = providerId;
  } else {
    const fromName = slugify(displayName!);
    baseSlug = fromName === "perfil" ? providerId : fromName;
  }
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${baseSlug}-${uniqueSuffix}`;
}

export type ServiceOption = {
  id: string;
  title: string;
  icon_key: string | null;
  color_key: string | null;
};

/** Search services by title for the offered-services selector. */
export async function searchServices(query: string): Promise<{
  services: ServiceOption[];
  error: string | null;
}> {
  const q = query.trim().toLowerCase();
  const { data, error } = await supabase
    .from("platform_services")
    .select("id, title, icon_key, color_key")
    .eq("active", true)
    .ilike("title", q ? `%${q}%` : "%")
    .order("title", { ascending: true })
    .limit(50);

  if (error) {
    logger.error("services_search_error", { error: error.message });
    return { services: [], error: error.message };
  }
  return { services: (data ?? []) as ServiceOption[], error: null };
}

/** Fetch id, title, icon_key, color_key for given service IDs (for displaying selected offered services). */
export async function getServicesByIds(ids: string[]): Promise<{
  services: ServiceOption[];
  error: string | null;
}> {
  if (ids.length === 0) return { services: [], error: null };
  const { data, error } = await supabase
    .from("platform_services")
    .select("id, title, icon_key, color_key")
    .in("id", ids);

  if (error) {
    logger.error("services_by_ids_error", { error: error.message });
    return { services: [], error: error.message };
  }
  return { services: (data ?? []) as ServiceOption[], error: null };
}

export async function listOfferedServices(providerId: string): Promise<{
  serviceIds: string[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("provider_offered_services")
    .select("service_id")
    .eq("provider_id", providerId)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.error("provider_offered_services_list_error", {
      error: error.message,
      providerId,
    });
    return { serviceIds: [], error: error.message };
  }
  return {
    serviceIds: (data ?? []).map((r) => r.service_id),
    error: null,
  };
}

export async function setOfferedServices(
  providerId: string,
  serviceIds: string[]
): Promise<{ error: string | null }> {
  const { error: deleteError } = await supabase
    .from("provider_offered_services")
    .delete()
    .eq("provider_id", providerId);

  if (deleteError) {
    logger.error("provider_offered_services_set_delete_error", {
      error: deleteError.message,
      providerId,
    });
    return { error: deleteError.message };
  }

  if (serviceIds.length === 0) return { error: null };

  const rows = serviceIds.map((service_id, i) => ({
    provider_id: providerId,
    service_id,
    sort_order: i,
  }));

  const { error: insertError } = await supabase
    .from("provider_offered_services")
    .insert(rows);

  if (insertError) {
    logger.error("provider_offered_services_set_insert_error", {
      error: insertError.message,
      providerId,
    });
    return { error: insertError.message };
  }
  return { error: null };
}

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
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await supabase
      .from("provider_portfolio_items")
      .update({ sort_order: i })
      .eq("id", itemIds[i])
      .eq("provider_id", providerId);
    if (error) {
      logger.error("provider_portfolio_reorder_error", {
        error: error.message,
        providerId,
      });
      return { error: error.message };
    }
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
