import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Service, ServiceWithChildren } from "../types/request-quote.types";

export interface GetServiceBySlugResult {
  service: Service | null;
  error: string | null;
}

export interface GetServiceByIdResult {
  service: Service | null;
  error: string | null;
}

export interface ListServicesForRequestQuoteResult {
  services: ServiceWithChildren[];
  error: string | null;
}

export async function getServiceBySlug(slug: string): Promise<GetServiceBySlugResult> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("slug", slug)
    .eq("show_on_request_quote", true)
    .maybeSingle();

  if (error) {
    logger.error("request_quote_service_fetch_by_slug_error", { slug, error: error.message });
    return { service: null, error: error.message };
  }
  return { service: data as Service | null, error: null };
}

export async function getServiceById(serviceId: string): Promise<GetServiceByIdResult> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    logger.error("request_quote_service_fetch_by_id_error", { serviceId, error: error.message });
    return { service: null, error: error.message };
  }
  return { service: data as Service | null, error: null };
}

/** Lists top-level services (and optionally sub-services) shown on request-quote page. */
export async function listServicesForRequestQuote(): Promise<ListServicesForRequestQuoteResult> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("show_on_request_quote", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    logger.error("request_quote_services_list_error", { error: error.message });
    return { services: [], error: error.message };
  }

  const rows = (data ?? []) as Service[];
  const byParent = new Map<string | null, Service[]>();
  for (const s of rows) {
    const key = s.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }

  function buildTree(parentId: string | null): ServiceWithChildren[] {
    const list = byParent.get(parentId) ?? [];
    return list.map((s) => ({
      ...s,
      children: buildTree(s.id).length > 0 ? buildTree(s.id) : undefined,
    }));
  }

  const services = buildTree(null);
  return { services, error: null };
}
