import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { PlatformState, PlatformCity, PlatformNeighborhood } from "../types/addresses.types";

export type { PlatformState, PlatformCity, PlatformNeighborhood } from "../types/addresses.types";

export interface ListStatesResult {
  states: PlatformState[];
  error: string | null;
}

export interface ListCitiesResult {
  cities: PlatformCity[];
  error: string | null;
}

export interface ListNeighborhoodsResult {
  neighborhoods: PlatformNeighborhood[];
  error: string | null;
}

export async function listStates(): Promise<ListStatesResult> {
  const { data, error } = await supabase
    .from("platform_states")
    .select("id, ibge_code, name, abbreviation, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    logger.error("platform_states_list_error", { error: error.message });
    return { states: [], error: error.message };
  }
  return { states: (data ?? []) as PlatformState[], error: null };
}

export async function listCitiesByState(stateId: string): Promise<ListCitiesResult> {
  const { data, error } = await supabase
    .from("platform_cities")
    .select("id, state_id, ibge_code, name, is_active, created_at, updated_at")
    .eq("state_id", stateId)
    .order("name", { ascending: true });

  if (error) {
    logger.error("platform_cities_list_error", { stateId, error: error.message });
    return { cities: [], error: error.message };
  }
  return { cities: (data ?? []) as PlatformCity[], error: null };
}

export async function listNeighborhoodsByCity(
  cityId: string
): Promise<ListNeighborhoodsResult> {
  const { data, error } = await supabase
    .from("platform_neighborhoods")
    .select("id, city_id, name, is_active, created_at, updated_at")
    .eq("city_id", cityId)
    .order("name", { ascending: true });

  if (error) {
    logger.error("platform_neighborhoods_list_error", { cityId, error: error.message });
    return { neighborhoods: [], error: error.message };
  }
  return { neighborhoods: (data ?? []) as PlatformNeighborhood[], error: null };
}

/** City with state abbreviation for search results (e.g. "Florianópolis, SC"). */
export interface CitySearchItem {
  id: string;
  name: string;
  state_abbreviation: string;
}

export interface SearchCitiesResult {
  cities: CitySearchItem[];
  error: string | null;
}

/** Neighborhood with city info for grouping (e.g. provider service area display). */
export interface NeighborhoodWithCity {
  id: string;
  name: string;
  city_id: string;
  city_name: string;
  state_abbreviation: string;
}

export interface GetNeighborhoodsByIdsResult {
  neighborhoods: NeighborhoodWithCity[];
  error: string | null;
}

/**
 * Fetch neighborhoods by IDs with city and state info. Used e.g. to display provider service area grouped by city.
 */
const MAX_NEIGHBORHOOD_IDS_PER_QUERY = 100;

export async function getNeighborhoodsByIds(
  ids: string[]
): Promise<GetNeighborhoodsByIdsResult> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { neighborhoods: [], error: null };

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_NEIGHBORHOOD_IDS_PER_QUERY) {
    chunks.push(unique.slice(i, i + MAX_NEIGHBORHOOD_IDS_PER_QUERY));
  }

  const merged: NeighborhoodWithCity[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("platform_neighborhoods")
      .select("id, name, city_id, platform_cities(name, platform_states(abbreviation))")
      .in("id", chunk);

    if (error) {
      logger.error("platform_neighborhoods_by_ids_error", { error: error.message });
      return { neighborhoods: [], error: error.message };
    }

    const neighborhoods: NeighborhoodWithCity[] = (data ?? []).map(
      (row: {
        id: string;
        name: string;
        city_id: string;
        platform_cities: { name: string; platform_states: { abbreviation: string } | null } | null;
      }) => ({
        id: row.id,
        name: row.name,
        city_id: row.city_id,
        city_name: row.platform_cities?.name ?? "",
        state_abbreviation: row.platform_cities?.platform_states?.abbreviation ?? "",
      })
    );
    merged.push(...neighborhoods);
  }

  return { neighborhoods: merged, error: null };
}

/**
 * Search platform cities by name (case-insensitive), returns city id, name and state abbreviation.
 * Used e.g. for provider service area selection.
 */
export async function searchCities(query: string): Promise<SearchCitiesResult> {
  const q = (query ?? "").trim();
  if (!q) {
    return { cities: [], error: null };
  }
  const { data, error } = await supabase
    .from("platform_cities")
    .select("id, name, platform_states(abbreviation)")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(30);

  if (error) {
    logger.error("platform_cities_search_error", { error: error.message });
    return { cities: [], error: error.message };
  }

  const cities: CitySearchItem[] = (data ?? []).map((row: { id: string; name: string; platform_states: { abbreviation: string } | null }) => ({
    id: row.id,
    name: row.name,
    state_abbreviation: row.platform_states?.abbreviation ?? "",
  }));
  return { cities, error: null };
}
