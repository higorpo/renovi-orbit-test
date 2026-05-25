import type { SupabaseClient } from "@supabase/supabase-js";
import { latLngToCell } from "npm:h3-js@4.4.0";
import type { Database } from "../_shared/database.types.ts";
import type { AddressPayloadNew } from "./types.ts";

export type CreateAddressResult =
  | { ok: true; addressId: string }
  | { ok: false; error: string };

/** H3 resolution 9: ~0.1 km² hexagon, suitable for address-level indexing. */
const H3_RESOLUTION_ADDRESS = 9;

/** Builds WKT for geography(Point, 4326). PostgREST/PostGIS accept WKT for insert. */
function buildLocationWkt(lat: number, lng: number): string | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/** Returns H3 cell index for WGS84 point, or null if invalid. */
function latLngToH3Index(lat: number, lng: number): string | null {
  try {
    return latLngToCell(lat, lng, H3_RESOLUTION_ADDRESS);
  } catch {
    return null;
  }
}

function toRow(clientId: string, payload: AddressPayloadNew) {
  const f = payload.formData;
  const street = f?.address_street ?? payload.street ?? "";
  const number = f?.address_number ?? payload.number ?? "";
  const complement = f?.address_complement ?? payload.complement ?? null;
  const neighborhood = f?.address_neighborhood ?? payload.neighborhood ?? "";
  const zipRaw = f?.address_zip ?? payload.zip_code ?? "";
  const zip_code = zipRaw.replace(/\D/g, "").slice(0, 8) || zipRaw;
  const city_id = f?.address_city_id ?? payload.city_id ?? "";
  const state_id = f?.address_state_id ?? payload.state_id ?? "";

  const loc = payload.location;
  const hasValidLocation =
    loc && typeof loc.latitude === "number" && typeof loc.longitude === "number";
  const location = hasValidLocation
    ? buildLocationWkt(loc!.latitude, loc!.longitude)
    : null;
  const h3_index =
    hasValidLocation && location
      ? latLngToH3Index(loc!.latitude, loc!.longitude)
      : null;

  return {
    client_id: clientId,
    label: payload.label ?? "Casa",
    street,
    number,
    complement,
    neighborhood,
    city_id,
    state_id,
    zip_code,
    is_default: payload.is_default ?? false,
    is_active: true,
    ...(location && { location }),
    ...(h3_index && { h3_index }),
  };
}

export async function createAddress(
  supabase: SupabaseClient<Database>,
  clientId: string,
  payload: AddressPayloadNew
): Promise<CreateAddressResult> {

  const { data, error } = await supabase
    .from("client_addresses")
    .insert(toRow(clientId, payload))
    .select("id")
    .single();

  if (error) {
    console.error("[createAddress]", error.message);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    addressId: data.id,
  };
}
