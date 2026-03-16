import { useEffect, useRef, useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { unmask } from "@/lib/masks";
import { maskCEP } from "@/lib/masks";
import { nominatimGeocodingService } from "@/lib/geocoding";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  addressFormSchema,
  defaultAddressFormData,
  type AddressFormData,
} from "../../types/addressForm.validation";
import { createAddress, updateAddress } from "../../api/addresses.api";
import { resolveFormDataFromCep } from "../../utils/resolveFormDataFromCep";
import {
  usePlatformStates,
  usePlatformCities,
  usePlatformNeighborhoods,
} from "../../hooks/usePlatformStatesAndCities";
import { addressToFormData } from "../../utils/addressToFormData";
import { ADDRESSES_LIST_QUERY_KEY } from "../../hooks/useAddressesList";
import type { ClientAddressWithRelations } from "../../types/addresses.types";
import { useAddressMapSync } from "../../hooks/useAddressMapSync";
import { AddressFormWithMap } from "../AddressFormWithMap/AddressFormWithMap";
import { useAuth } from "@/features/auth";

export interface AddressFormDialogProps {
  open: boolean;
  mode: "add" | "edit";
  address: ClientAddressWithRelations | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddressFormDialog({
  open,
  mode,
  address,
  onClose,
  onSuccess,
}: AddressFormDialogProps) {
  const { user } = useAuth();
  const clientId = user?.id ?? "";
  const queryClient = useQueryClient();
  const lastCepRef = useRef<string>("");
  const numberInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<AddressFormData>(defaultAddressFormData);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const stateId = formData.address_state_id || null;
  const cityId = formData.address_city_id || null;

  const { states } = usePlatformStates();
  const { cities, isLoading: citiesLoading } = usePlatformCities(stateId);
  const { neighborhoods, isLoading: neighborhoodsLoading } =
    usePlatformNeighborhoods(cityId);

  const { handleMapDrag, reverseGeocoding, triggerGeocodeNow } = useAddressMapSync({
    formData,
    setFormData,
    location,
    setLocation,
    geocodingService: nominatimGeocodingService,
    disabled: fetchingCep,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "add") {
      setFormData(defaultAddressFormData);
      setLocation(null);
      lastCepRef.current = "";
    } else if (address) {
      setFormData(addressToFormData(address));
      const lat = address.latitude ?? null;
      const lng = address.longitude ?? null;
      setLocation(
        lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
          ? { latitude: lat, longitude: lng }
          : null
      );
      lastCepRef.current = unmask(maskCEP(address.zip_code));
    }
  }, [open, mode, address]);

  useEffect(() => {
    if (!open || mode !== "edit" || !address || neighborhoods.length === 0) return;
    const current = formData.address_neighborhood_id;
    if (current) return;
    const match = neighborhoods.find(
      (n) =>
        n.name.trim().toLowerCase() === address.neighborhood.trim().toLowerCase()
    );
    if (match) setFormData((prev) => ({ ...prev, address_neighborhood_id: match.id }));
  }, [open, mode, address, neighborhoods, formData.address_neighborhood_id]);

  const runCepResolution = useCallback(async (cepMasked: string) => {
    const cep = unmask(cepMasked);
    if (cep.length !== 8 || cep === lastCepRef.current) return;
    lastCepRef.current = cep;
    setFetchingCep(true);
    const result = await resolveFormDataFromCep(cepMasked);
    setFetchingCep(false);
    if (result === null) return;
    if (!result.ok && "cepNotFound" in result && result.cepNotFound) {
      toast.error("CEP não encontrado.");
      lastCepRef.current = "";
      return;
    }
    if (!result.ok && "notAvailable" in result && result.notAvailable) {
      toast.error("CEP ainda não disponível na nossa base.");
      lastCepRef.current = "";
      return;
    }
    if (result.ok && result.data) {
      setFormData((prev) => ({ ...prev, ...result.data }));
      window.setTimeout(() => numberInputRef.current?.focus(), 100);
    }
  }, []);

  useEffect(() => {
    const cep = unmask(formData.address_zip);
    if (cep.length === 8) runCepResolution(formData.address_zip);
  }, [formData.address_zip, runCepResolution]);

  const handleCepBlur = useCallback(() => {
    runCepResolution(formData.address_zip);
  }, [formData.address_zip, runCepResolution]);

  const handleStateChange = (stateId: string) => {
    const state = states.find((s) => s.id === stateId);
    if (!state) return;
    setFormData((prev) => ({
      ...prev,
      address_state_id: stateId,
      address_state: state.abbreviation,
      address_city_id: "",
      address_city: "",
      address_neighborhood_id: "",
      address_neighborhood: "",
    }));
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find((c) => c.id === cityId);
    if (!city) return;
    setFormData((prev) => ({
      ...prev,
      address_city_id: cityId,
      address_city: city.name,
      address_neighborhood_id: "",
      address_neighborhood: "",
    }));
  };

  const handleNeighborhoodChange = (neighborhoodId: string) => {
    const neighborhood = neighborhoods.find((n) => n.id === neighborhoodId);
    if (!neighborhood) return;
    setFormData((prev) => ({
      ...prev,
      address_neighborhood_id: neighborhoodId,
      address_neighborhood: neighborhood.name,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = addressFormSchema.safeParse(formData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first.message);
      return;
    }
    const data = parsed.data;
    const cleanCep = unmask(data.address_zip);
    setSubmitting(true);
    try {
      if (mode === "add") {
        const result = await createAddress({
          client_id: clientId,
          label: "Casa",
          street: data.address_street,
          number: data.address_number,
          complement: data.address_complement || null,
          neighborhood: data.address_neighborhood,
          city_id: data.address_city_id,
          state_id: data.address_state_id,
          zip_code: cleanCep,
          is_default: false,
          is_active: true,
          ...(location && {
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
      } else if (address) {
        const result = await updateAddress(address.id, clientId, {
          street: data.address_street,
          number: data.address_number,
          complement: data.address_complement || null,
          neighborhood: data.address_neighborhood,
          city_id: data.address_city_id,
          state_id: data.address_state_id,
          zip_code: cleanCep,
          ...(location && {
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
      }
      queryClient.invalidateQueries({ queryKey: ADDRESSES_LIST_QUERY_KEY });
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "add" ? "Adicionar endereço" : "Editar endereço";
  const isDesktop = useBreakpointMd();

  const formContent = (
    <form
      id="address-form-dialog-form"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      <AddressFormWithMap
        formData={formData}
        setFormData={setFormData}
        location={location}
        onLocationChange={handleMapDrag}
        handleCepBlur={handleCepBlur}
        fetchingCep={fetchingCep}
        states={states}
        cities={cities}
        neighborhoods={neighborhoods}
        statesLoading={false}
        citiesLoading={citiesLoading}
        neighborhoodsLoading={neighborhoodsLoading}
        onStateChange={handleStateChange}
        onCityChange={handleCityChange}
        onNeighborhoodChange={handleNeighborhoodChange}
        reverseGeocoding={reverseGeocoding}
        idPrefix="dialog-addr-"
        numberInputRef={numberInputRef}
        onNumberBlur={triggerGeocodeNow}
        mapDescription="Arraste o marcador para ajustar o ponto exato. Rua e número podem ser atualizados automaticamente."
      />
    </form>
  );

  const footerContent = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form="address-form-dialog-form" disabled={submitting}>
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          "Salvar"
        )}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {formContent}
          <DialogFooter>{footerContent}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col rounded-t-2xl p-0"
      >
        <div
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
          aria-hidden
        />
        <SheetHeader className="shrink-0 border-b px-4 py-3 text-left">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {formContent}
        </div>
        <SheetFooter className="shrink-0 w-full flex-row gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex w-full gap-2 [&>button]:flex-1">
            {footerContent}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
