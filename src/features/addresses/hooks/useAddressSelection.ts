import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { unmask } from "@/lib/masks";
import { useAnalytics } from "@/hooks/useAnalytics";
import { addBreadcrumb } from "@/lib/sentry";
import { listAddresses } from "../api/addresses.api";
import { resolveFormDataFromCep } from "../utils/resolveFormDataFromCep";
import type { ClientAddressWithRelations } from "../types/addresses.types";
import type { AddressSelection, AddressLocation } from "../types/addresses.types";
import { defaultAddressFormData } from "../types/addressForm.validation";
import type { AddressFormData } from "../types/addressForm.validation";

export interface UseAddressSelectionParams {
  userId: string | null;
  onSelectionChange: (payload: AddressSelection) => void;
  /** Optional ref for the number input; focused after CEP fills the form successfully */
  numberInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Persisted selection from parent (e.g. when returning to step); used to initialize local state */
  initialSelection?: AddressSelection | null;
}

export interface UseAddressSelectionResult {
  formData: AddressFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddressFormData>>;
  /** Coordinates from map or geocoding; persisted as client_addresses.location when creating address. */
  location: AddressLocation | null;
  setLocation: (loc: AddressLocation | null) => void;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  showNewAddressForm: boolean;
  setShowNewAddressForm: (show: boolean) => void;
  /** True when form was restored from persisted step data (returning to step); used to hide "back to list" button */
  restoredFromPersisted: boolean;
  fetchingCep: boolean;
  addresses: ClientAddressWithRelations[];
  handleCepBlur: () => void;
}

export function useAddressSelection({
  userId,
  onSelectionChange,
  numberInputRef,
  initialSelection,
}: UseAddressSelectionParams): UseAddressSelectionResult {
  const { trackEvent } = useAnalytics();
  const [formData, setFormData] = useState<AddressFormData>(() =>
    initialSelection?.kind === "new" ? initialSelection.formData : defaultAddressFormData
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(() =>
    initialSelection?.kind === "existing" ? initialSelection.addressId : null
  );
  const [showNewAddressForm, setShowNewAddressForm] = useState(() =>
    initialSelection?.kind === "new" ? true : false
  );
  const [restoredFromPersisted] = useState(() => initialSelection?.kind === "new");
  const [fetchingCep, setFetchingCep] = useState(false);
  const [location, setLocation] = useState<AddressLocation | null>(() =>
    initialSelection?.kind === "new" && initialSelection.location
      ? initialSelection.location
      : null
  );
  const lastResolvedCepRef = useRef<string | null>(null);

  // When restoring from persisted step data, mark CEP as already resolved so we don't re-fetch
  useEffect(() => {
    if (initialSelection?.kind === "new") {
      const cep = unmask(initialSelection.formData.address_zip);
      if (cep.length === 8) lastResolvedCepRef.current = cep;
    }
  }, [initialSelection]);

  const { data: addressesData } = useQuery({
    queryKey: ["client-addresses", userId],
    queryFn: () => listAddresses(userId!),
    enabled: !!userId,
  });

  const addresses = useMemo(
    () => (addressesData?.addresses ?? []) as ClientAddressWithRelations[],
    [addressesData?.addresses]
  );

  useEffect(() => {
    if (userId && addresses.length > 0 && !showNewAddressForm) {
      if (selectedAddressId) {
        const addr = addresses.find((a) => a.id === selectedAddressId);
        if (addr) {
          onSelectionChange({
            kind: "existing",
            addressId: addr.id,
          });
          return;
        }
      }
      onSelectionChange(null);
      return;
    }
    onSelectionChange({ kind: "new", formData, location: location ?? undefined });
  }, [userId, addresses, selectedAddressId, showNewAddressForm, formData, location, onSelectionChange]);

  const runCepResolution = useCallback(
    async (cepMasked: string) => {
      const cep = unmask(cepMasked);
      if (cep.length !== 8) return;
      if (cep === lastResolvedCepRef.current) return;

      setFetchingCep(true);
      const resolved = await resolveFormDataFromCep(cepMasked);
      setFetchingCep(false);

      if (resolved === null) return;

      if (resolved.ok === false && "cepNotFound" in resolved && resolved.cepNotFound) {
        addBreadcrumb({
          category: "address",
          message: "address.cep_not_found",
          level: "warning",
          data: { cepPrefix: cep.slice(0, 5) },
        });
        lastResolvedCepRef.current = null;
        setFormData((prev) => ({
          ...prev,
          address_zip: "",
          address_street: "",
          address_number: "",
          address_complement: "",
          address_state_id: "",
          address_state: "",
          address_city_id: "",
          address_city: "",
          address_neighborhood_id: "",
          address_neighborhood: "",
        }));
        toast.error("O CEP digitado não existe.");
        return;
      }

      if (resolved.ok === false && "notAvailable" in resolved && resolved.notAvailable) {
        addBreadcrumb({
          category: "address",
          message: "address.cep_region_not_available",
          level: "warning",
          data: { cepPrefix: cep.slice(0, 5) },
        });
        lastResolvedCepRef.current = null;
        trackEvent("cep_not_available", { cep_prefix: cep.slice(0, 5) });
        setFormData((prev) => ({
          ...prev,
          address_zip: "",
          address_street: "",
          address_number: "",
          address_complement: "",
          address_state_id: "",
          address_state: "",
          address_city_id: "",
          address_city: "",
          address_neighborhood_id: "",
          address_neighborhood: "",
        }));
        toast.warning("A Renovi ainda não está disponível nessa localização.");
        return;
      }

      if (resolved.ok && resolved.data) {
        addBreadcrumb({
          category: "address",
          message: "address.cep_resolved",
          data: { cepPrefix: cep.slice(0, 5) },
        });
        lastResolvedCepRef.current = cep;
        setFormData((prev) => ({
          ...prev,
          ...resolved.data,
        }));
        // Delay focus so it runs after React commit and any Select/Radix focus handling
        window.setTimeout(() => {
          numberInputRef?.current?.focus();
        }, 100);
      }
    },
    [numberInputRef]
  );

  useEffect(() => {
    const cep = unmask(formData.address_zip);
    if (cep.length === 8) runCepResolution(formData.address_zip);
  }, [formData.address_zip, runCepResolution]);

  const handleCepBlur = useCallback(() => {
    runCepResolution(formData.address_zip);
  }, [formData.address_zip, runCepResolution]);

  return {
    formData,
    setFormData,
    location,
    setLocation,
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    restoredFromPersisted,
    fetchingCep,
    addresses,
    handleCepBlur,
  };
}
