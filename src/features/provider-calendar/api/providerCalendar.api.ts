import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type {
  ScheduledServiceItem,
  ScheduledServicesRangeResult,
  ScheduledShift,
} from "../types/provider-calendar.types";

interface RpcScheduledServiceRow {
  service_request_id: string;
  contracted_service_id: string;
  title: string;
  platform_service_title: string | null;
  platform_service_color_key: string | null;
  scheduled_start_date: string;
  scheduled_end_date: string;
  scheduled_shift: ScheduledShift;
  status: string;
}

interface RpcScheduledServicesResponse {
  items: RpcScheduledServiceRow[];
  range_from: string;
  range_to: string;
  has_more_before: boolean;
  has_more_after: boolean;
}

function mapRow(row: RpcScheduledServiceRow): ScheduledServiceItem {
  return {
    serviceRequestId: row.service_request_id,
    contractedServiceId: row.contracted_service_id,
    title: row.title,
    platformServiceTitle: row.platform_service_title,
    platformServiceColorKey: row.platform_service_color_key,
    scheduledStartDate: row.scheduled_start_date,
    scheduledEndDate: row.scheduled_end_date,
    scheduledShift: row.scheduled_shift,
    status: row.status,
  };
}

export async function fetchProviderScheduledServices(
  fromDate: string,
  toDate: string,
): Promise<{ data: ScheduledServicesRangeResult | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("list_provider_scheduled_services", {
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) {
    logger.error("provider_calendar_fetch_failed", {
      fromDate,
      toDate,
      message: error.message,
    });
    return { data: null, error: new Error(error.message) };
  }

  const payload = data as RpcScheduledServicesResponse | null;
  if (!payload) {
    return { data: null, error: new Error("Empty calendar response") };
  }

  return {
    data: {
      items: (payload.items ?? []).map(mapRow),
      rangeFrom: payload.range_from,
      rangeTo: payload.range_to,
      hasMoreBefore: payload.has_more_before,
      hasMoreAfter: payload.has_more_after,
    },
    error: null,
  };
}
