import { MapPin, Check, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { nominatimGeocodingService } from "@/lib/geocoding";
import { useAddressSelection } from "../../hooks/useAddressSelection";
import { useAddressMapSync } from "../../hooks/useAddressMapSync";
import {
  usePlatformStates,
  usePlatformCities,
  usePlatformNeighborhoods,
} from "../../hooks/usePlatformStatesAndCities";
import type { AddressSelection } from "../../types/addresses.types";
import { AddressFormWithMap } from "../AddressFormWithMap/AddressFormWithMap";

export interface AddressSelectionStepProps {
  userId: string | null;
  onSelectionChange: (payload: AddressSelection) => void;
  step4Data?: AddressSelection | null;
  title?: string;
  choosePrompt?: string;
  newAddressLabel?: string;
  backToAddressesLabel?: string;
}

export function AddressSelectionStep({
  userId,
  onSelectionChange,
  step4Data = null,
  title = "Endereço do serviço",
  choosePrompt = "Escolha um endereço ou cadastre um novo.",
  newAddressLabel = "Cadastrar novo endereço",
  backToAddressesLabel = "Voltar para meus endereços",
}: AddressSelectionStepProps) {
  const numberInputRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useAddressSelection({ userId, onSelectionChange, numberInputRef, initialSelection: step4Data });

  const { handleMapDrag, reverseGeocoding } = useAddressMapSync({
    formData,
    setFormData,
    location,
    setLocation,
    geocodingService: nominatimGeocodingService,
    disabled: fetchingCep,
  });

  const { states, isLoading: statesLoading } = usePlatformStates();
  const { cities, isLoading: citiesLoading } = usePlatformCities(
    formData.address_state_id || null
  );
  const { neighborhoods, isLoading: neighborhoodsLoading } = usePlatformNeighborhoods(
    formData.address_city_id || null
  );

  const handleStateChange = (stateId: string) => {
    const state = states.find((s) => s.id === stateId);
    if (!state) return;
    setFormData((prev) => ({
      ...prev,
      address_state_id: stateId,
      address_state: state.abbreviation,
      address_city_id: "",
      address_city: "",
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

  const stepInputClassName = "bg-background border-border text-foreground placeholder:text-muted-foreground w-full";

  if (userId && addresses.length > 0 && !showNewAddressForm) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <SectionTitleWithIcon
          title={title}
          icon={MapPin}
          iconGradient="from-emerald-500 to-teal-500"
          subtitle={choosePrompt}
        />
        <div className="space-y-2">
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => setSelectedAddressId(addr.id)}
              className={`w-full text-left p-3 sm:p-4 rounded-lg border transition ${
                selectedAddressId === addr.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              } text-foreground`}
            >
              <div className="flex items-center gap-2">
                {selectedAddressId === addr.id && <Check className="h-4 w-4" />}
                <span>
                  {addr.street}, {addr.number}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {addr.neighborhood}, {addr.platform_cities?.name ?? ""} - {addr.platform_states?.abbreviation ?? ""}
              </span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-border text-foreground hover:bg-muted"
          onClick={() => {
            setShowNewAddressForm(true);
            setSelectedAddressId(null);
          }}
        >
          <MapPin className="h-4 w-4 mr-2" />
          {newAddressLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionTitleWithIcon
        title={title}
        icon={MapPin}
        iconGradient="from-emerald-500 to-teal-500"
      />
      {showNewAddressForm && !restoredFromPersisted && userId && addresses.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setShowNewAddressForm(false)}
        >
          {backToAddressesLabel}
        </Button>
      )}
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
        statesLoading={statesLoading}
        citiesLoading={citiesLoading}
        neighborhoodsLoading={neighborhoodsLoading}
        onStateChange={handleStateChange}
        onCityChange={handleCityChange}
        onNeighborhoodChange={handleNeighborhoodChange}
        reverseGeocoding={reverseGeocoding}
        numberInputRef={numberInputRef}
        inputClassName={stepInputClassName}
        cepRightIcon={
          fetchingCep ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : undefined
        }
        mapDescription="Arraste o marcador para ajustar o ponto exato do serviço. Rua e número podem ser atualizados automaticamente."
        showRegionInfo
      />
    </div>
  );
}
