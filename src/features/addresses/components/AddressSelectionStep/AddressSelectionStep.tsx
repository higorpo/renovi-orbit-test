import { MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  title?: string;
  choosePrompt?: string;
  newAddressLabel?: string;
  backToAddressesLabel?: string;
}

export function AddressSelectionStep({
  userId,
  onSelectionChange,
  title = "Endereço do serviço",
  choosePrompt = "Escolha um endereço ou cadastre um novo.",
  newAddressLabel = "Cadastrar novo endereço",
  backToAddressesLabel = "Voltar para meus endereços",
}: AddressSelectionStepProps) {
  const {
    formData,
    setFormData,
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    fetchingCep,
    addresses,
    handleCepBlur,
  } = useAddressSelection({ userId, onSelectionChange });

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
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-white/80">{choosePrompt}</p>
        <div className="space-y-2">
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => setSelectedAddressId(addr.id)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedAddressId === addr.id
                  ? "border-primary bg-white/10"
                  : "border-white/20 hover:bg-white/5"
              } text-white`}
            >
              <div className="flex items-center gap-2">
                {selectedAddressId === addr.id && <Check className="h-4 w-4" />}
                <span>
                  {addr.street}, {addr.number}
                </span>
              </div>
              <span className="text-sm text-white/70">
                {addr.neighborhood}, {addr.city} - {addr.state}
              </span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/30 text-white"
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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {showNewAddressForm && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/80"
          onClick={() => setShowNewAddressForm(false)}
        >
          {backToAddressesLabel}
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-white/90">CEP</Label>
          <Input
            value={formData.address_zip}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_zip: maskCEP(e.target.value) }))
            }
            onBlur={handleCepBlur}
            placeholder="00000-000"
            className="bg-white/10 border-white/30 text-white"
          />
          {fetchingCep && <p className="text-xs text-white/60 mt-1">Buscando...</p>}
        </div>
        <div>
          <Label className="text-white/90">Rua</Label>
          <Input
            value={formData.address_street}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_street: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Número</Label>
          <Input
            value={formData.address_number}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_number: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Complemento</Label>
          <Input
            value={formData.address_complement}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_complement: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Estado</Label>
          <Select
            value={formData.address_state_id || ""}
            onValueChange={handleStateChange}
            disabled={statesLoading}
          >
            <SelectTrigger className="bg-white/10 border-white/30 text-white w-full">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id} className="focus:bg-white/10">
                  {s.name} ({s.abbreviation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/90">Cidade</Label>
          <Select
            value={formData.address_city_id || ""}
            onValueChange={handleCityChange}
            disabled={!formData.address_state_id || citiesLoading}
          >
            <SelectTrigger className="bg-white/10 border-white/30 text-white w-full">
              <SelectValue placeholder="Selecione a cidade" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id} className="focus:bg-white/10">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/90">Bairro</Label>
          <Select
            value={formData.address_neighborhood_id || ""}
            onValueChange={handleNeighborhoodChange}
            disabled={!formData.address_city_id || neighborhoodsLoading}
          >
            <SelectTrigger className="bg-white/10 border-white/30 text-white w-full">
              <SelectValue placeholder="Selecione o bairro" />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map((n) => (
                <SelectItem key={n.id} value={n.id} className="focus:bg-white/10">
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
