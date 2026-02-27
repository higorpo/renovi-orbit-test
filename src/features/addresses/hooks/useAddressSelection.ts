import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { unmask } from "@/lib/masks";
import { fetchAddressByCEP } from "@/lib/cep";
import { listAddresses } from "../api/addresses.api";
import type { ClientAddress } from "../types/addresses.types";
import type { AddressSelection } from "../types/addresses.types";
import { defaultAddressFormData } from "../types/addressForm.validation";
import type { AddressFormData } from "../types/addressForm.validation";

export interface UseAddressSelectionParams {
  userId: string | null;
  onSelectionChange: (payload: AddressSelection) => void;
}

export interface UseAddressSelectionResult {
  formData: AddressFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddressFormData>>;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  showNewAddressForm: boolean;
  setShowNewAddressForm: (show: boolean) => void;
  fetchingCep: boolean;
  addresses: ClientAddress[];
  handleCepBlur: () => Promise<void>;
}

export function useAddressSelection({
  userId,
  onSelectionChange,
}: UseAddressSelectionParams): UseAddressSelectionResult {
  const [formData, setFormData] = useState<AddressFormData>(defaultAddressFormData);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const { data: addressesData } = useQuery({
    queryKey: ["client-addresses", userId],
    queryFn: () => listAddresses(userId!),
    enabled: !!userId,
  });

  const addresses = useMemo(
    () => (addressesData?.addresses ?? []) as ClientAddress[],
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
            city: addr.city,
            neighborhood: addr.neighborhood,
            state: addr.state,
          });
          return;
        }
      }
      onSelectionChange(null);
      return;
    }
    onSelectionChange({ kind: "new", formData });
  }, [userId, addresses, selectedAddressId, showNewAddressForm, formData, onSelectionChange]);

  const handleCepBlur = useCallback(async () => {
    const cep = unmask(formData.address_zip);
    if (cep.length !== 8) return;
    setFetchingCep(true);
    const res = await fetchAddressByCEP(formData.address_zip);
    setFetchingCep(false);
    if (res) {
      setFormData((prev) => ({
        ...prev,
        address_street: res.logradouro || prev.address_street,
      }));
    }
  }, [formData.address_zip]);

  return {
    formData,
    setFormData,
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    fetchingCep,
    addresses,
    handleCepBlur,
  };
}
