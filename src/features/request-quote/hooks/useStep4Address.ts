import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { unmask } from "@/lib/masks";
import { fetchAddressByCEP } from "@/lib/cep";
import { listAddresses } from "@/features/addresses";
import type { ClientAddress } from "@/features/addresses";
import { defaultStep4 } from "../components/RequestQuote/schemas";
import type { Step4Data, Step4FormData } from "../components/RequestQuote/schemas";

export interface UseStep4AddressParams {
  userId: string | null;
  onStep4DataChange: (payload: Step4Data) => void;
}

export interface UseStep4AddressResult {
  step4FormData: Step4FormData;
  setStep4FormData: React.Dispatch<React.SetStateAction<Step4FormData>>;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
  showNewAddressForm: boolean;
  setShowNewAddressForm: (show: boolean) => void;
  fetchingCep: boolean;
  addresses: ClientAddress[];
  handleCepBlur: () => Promise<void>;
}

export function useStep4Address({
  userId,
  onStep4DataChange,
}: UseStep4AddressParams): UseStep4AddressResult {
  const [step4FormData, setStep4FormData] = useState<Step4FormData>(defaultStep4);
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
          onStep4DataChange({
            kind: "existing",
            addressId: addr.id,
            city: addr.city,
            neighborhood: addr.neighborhood,
            state: addr.state,
          });
          return;
        }
      }
      onStep4DataChange(null);
      return;
    }
    onStep4DataChange({ kind: "new", formData: step4FormData });
  }, [userId, addresses, selectedAddressId, showNewAddressForm, step4FormData, onStep4DataChange]);

  const handleCepBlur = useCallback(async () => {
    const cep = unmask(step4FormData.address_zip);
    if (cep.length !== 8) return;
    setFetchingCep(true);
    const res = await fetchAddressByCEP(step4FormData.address_zip);
    setFetchingCep(false);
    if (res) {
      setStep4FormData((prev) => ({
        ...prev,
        address_street: res.logradouro || prev.address_street,
        address_neighborhood: res.bairro || prev.address_neighborhood,
        address_city: res.localidade || prev.address_city,
        address_state: res.uf || prev.address_state,
      }));
    }
  }, [step4FormData.address_zip]);

  return {
    step4FormData,
    setStep4FormData,
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    fetchingCep,
    addresses,
    handleCepBlur,
  };
}
