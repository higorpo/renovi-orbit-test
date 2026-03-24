import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Tables } from "@/lib/supabase/database.types";

export type ProviderPublicProfile = Tables<"provider_profiles_public">;
/** Public profile with service area neighborhood IDs and display fields derived from provider_service_area_neighborhoods. */
export type ProviderPublicProfileWithServiceArea = ProviderPublicProfile & {
  service_area_neighborhood_ids: string[];
  /** Derived from neighborhoods for form display. */
  service_area_city: string | null;
  service_area_regions: string[] | null;
  service_area_neighborhoods: string[] | null;
};

export interface GetProviderPublicResult {
  data: ProviderPublicProfileWithServiceArea | null;
  error: string | null;
}

export interface UpdateProviderPublicParams {
  slug?: string;
  display_name?: string | null;
  bio?: string | null;
  profile_visibility?: "public" | "restricted";
  /** Replaces provider_service_area_neighborhoods rows; display text is derived from platform data when reading. */
  service_area_neighborhood_ids?: string[] | null;
}

/** Normalize string to URL-safe slug: lowercase, hyphen, no accents. */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "perfil"
  );
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
    const cityNames = [
      ...new Set(rows.map((r) => r.platform_cities?.name ?? "").filter(Boolean)),
    ];
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
