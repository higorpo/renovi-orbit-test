import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

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
