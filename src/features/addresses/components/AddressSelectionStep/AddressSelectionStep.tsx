import { MapPin, Check, Info, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { maskCEP } from "@/lib/masks";
import { useAddressSelection } from "../../hooks/useAddressSelection";
import {
  usePlatformStates,
  usePlatformCities,
  usePlatformNeighborhoods,
} from "../../hooks/usePlatformStatesAndCities";
import type { AddressSelection } from "../../types/addresses.types";

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
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    restoredFromPersisted,
    fetchingCep,
    addresses,
    handleCepBlur,
  } = useAddressSelection({ userId, onSelectionChange, numberInputRef, initialSelection: step4Data });

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
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        <div>
          <Label className="text-foreground">CEP</Label>
          <Input
            value={formData.address_zip}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_zip: maskCEP(e.target.value) }))
            }
            onBlur={handleCepBlur}
            placeholder="00000-000"
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            rightIcon={
              fetchingCep ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : undefined
            }
          />
        </div>
        <div>
          <Label className="text-foreground">Estado</Label>
          <Select
            value={formData.address_state_id || ""}
            onValueChange={handleStateChange}
            disabled={statesLoading || fetchingCep}
          >
            <SelectTrigger className="bg-background border-border text-foreground w-full">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.abbreviation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-foreground">Cidade</Label>
          <Select
            value={formData.address_city_id || ""}
            onValueChange={handleCityChange}
            disabled={!formData.address_state_id || citiesLoading || fetchingCep}
          >
            <SelectTrigger className="bg-background border-border text-foreground w-full">
              <SelectValue placeholder="Selecione a cidade" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-foreground">Bairro</Label>
          <Select
            value={formData.address_neighborhood_id || ""}
            onValueChange={handleNeighborhoodChange}
            disabled={!formData.address_city_id || neighborhoodsLoading || fetchingCep}
          >
            <SelectTrigger className="bg-background border-border text-foreground w-full">
              <SelectValue placeholder="Selecione o bairro" />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-foreground">Rua</Label>
          <Input
            value={formData.address_street}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_street: e.target.value }))
            }
            disabled={fetchingCep}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-foreground">Número</Label>
          <Input
            ref={numberInputRef}
            value={formData.address_number}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_number: e.target.value }))
            }
            disabled={fetchingCep}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-foreground">Complemento</Label>
          <Input
            value={formData.address_complement}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_complement: e.target.value }))
            }
            placeholder="Apto, bloco, etc. (opcional)"
            disabled={fetchingCep}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 flex gap-2 sm:gap-3">
        <Info className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-muted-foreground">
          Não conseguiu selecionar estado, cidade ou bairro? A Renovi ainda não está presente na sua região.
          Você pode seguir nosso Instagram em{" "}
          <a
            href="https://www.instagram.com/renovi.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            @renovi.com.br
          </a>
          {" "}para acompanhar novidades.
        </p>
      </div>
    </div>
  );
}
