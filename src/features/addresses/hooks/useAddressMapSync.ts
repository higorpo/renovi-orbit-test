import { useEffect, useRef, useCallback, useState } from "react";
import type { GeocodingService } from "@/lib/geocoding";
import { maskCEP } from "@/lib/masks";
import type { AddressFormData } from "../types/addressForm.validation";
import type { AddressLocation } from "../types/addresses.types";

const DEBOUNCE_MS = 1500;
const IGNORE_GEOCODE_AFTER_REVERSE_MS = 2500;

function buildAddressString(form: AddressFormData): string {
  const parts = [
    [form.address_street, form.address_number].filter(Boolean).join(" "),
    form.address_neighborhood,
    form.address_city,
    form.address_state,
    "Brasil",
  ].filter(Boolean);
  return parts.join(", ");
}

export interface UseAddressMapSyncParams {
  formData: AddressFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddressFormData>>;
  location: AddressLocation | null;
  setLocation: (loc: AddressLocation | null) => void;
  geocodingService: GeocodingService;
  /** When true, skip debounced geocode (e.g. form not ready). */
  disabled?: boolean;
}

export interface UseAddressMapSyncResult {
  /** Call when user drags the map marker. Updates location and reverse-geocodes to form. */
  handleMapDrag: (lat: number, lng: number) => void;
  /** True while reverse geocoding after a drag. */
  reverseGeocoding: boolean;
  /** Run geocode now with current form data and update map (e.g. on number field blur in dialog). */
  triggerGeocodeNow: () => void;
}

export function useAddressMapSync({
  formData,
  setFormData,
  setLocation,
  geocodingService,
  disabled = false,
}: UseAddressMapSyncParams): UseAddressMapSyncResult {
  const ignoreGeocodeRef = useRef(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const [reverseGeocoding, setReverseGeocoding] = useState(false);

  const handleMapDrag = useCallback(
    async (lat: number, lng: number) => {
      setLocation({ latitude: lat, longitude: lng });
      ignoreGeocodeRef.current = true;
      setReverseGeocoding(true);
      try {
        const result = await geocodingService.reverseGeocode(lat, lng);
        if (result) {
          const zipRaw = result.postalCode?.replace(/\D/g, "").slice(0, 8) ?? "";
          setFormData((prev) => ({
            ...prev,
            address_street: result.street ?? prev.address_street,
            address_number: result.number ?? prev.address_number,
            address_zip: zipRaw ? maskCEP(zipRaw) : prev.address_zip,
            address_neighborhood: result.neighborhood ?? prev.address_neighborhood,
            address_neighborhood_id: result.neighborhood ? "" : prev.address_neighborhood_id,
          }));
        }
      } finally {
        setReverseGeocoding(false);
        setTimeout(() => {
          ignoreGeocodeRef.current = false;
        }, IGNORE_GEOCODE_AFTER_REVERSE_MS);
      }
    },
    [geocodingService, setFormData, setLocation]
  );

  useEffect(() => {
    if (disabled || ignoreGeocodeRef.current) return;
    const hasMinimalAddress =
      formData.address_street?.trim() &&
      formData.address_city?.trim() &&
      formData.address_state?.trim();
    if (!hasMinimalAddress) return;

    const timer = setTimeout(async () => {
      const query = buildAddressString(formData);
      if (!query.trim()) return;
      const result = await geocodingService.geocode(query);
      if (result) {
        setLocation({ latitude: result.latitude, longitude: result.longitude });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [disabled, formData, setLocation, geocodingService]);

  const triggerGeocodeNow = useCallback(async () => {
    if (disabled || ignoreGeocodeRef.current) return;
    const data = formDataRef.current;
    const hasMinimalAddress =
      data.address_street?.trim() &&
      data.address_city?.trim() &&
      data.address_state?.trim();
    if (!hasMinimalAddress) return;
    const query = buildAddressString(data);
    if (!query.trim()) return;
    const result = await geocodingService.geocode(query);
    if (result) {
      setLocation({ latitude: result.latitude, longitude: result.longitude });
    }
  }, [disabled, geocodingService, setLocation]);

  return { handleMapDrag, reverseGeocoding, triggerGeocodeNow };
}
