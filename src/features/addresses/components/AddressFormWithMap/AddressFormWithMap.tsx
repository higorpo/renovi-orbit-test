import { useRef, type RefObject } from "react";
import { Loader2, Info } from "lucide-react";
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
import type { AddressFormData } from "../../types/addressForm.validation";
import type { AddressLocation } from "../../types/addresses.types";
import type { PlatformState, PlatformCity, PlatformNeighborhood } from "../../types/addresses.types";
import { AddressMap } from "../AddressMap/AddressMap";

export interface AddressFormWithMapProps {
  formData: AddressFormData;
  setFormData: React.Dispatch<React.SetStateAction<AddressFormData>>;
  location: AddressLocation | null;
  onLocationChange: (lat: number, lng: number) => void;
  handleCepBlur: () => void;
  fetchingCep: boolean;
  states: PlatformState[];
  cities: PlatformCity[];
  neighborhoods: PlatformNeighborhood[];
  statesLoading?: boolean;
  citiesLoading?: boolean;
  neighborhoodsLoading?: boolean;
  onStateChange: (stateId: string) => void;
  onCityChange: (cityId: string) => void;
  onNeighborhoodChange: (neighborhoodId: string) => void;
  reverseGeocoding: boolean;
  /** Optional id prefix for inputs (e.g. "addr-" for dialog to avoid duplicate ids). */
  idPrefix?: string;
  /** Optional ref for the number input (e.g. focus after CEP resolution in step). */
  numberInputRef?: RefObject<HTMLInputElement | null>;
  /** Optional class for inputs/selects (e.g. step uses bg-background border-border). */
  inputClassName?: string;
  /** Optional right icon for CEP input (e.g. Loader2 when fetching). */
  cepRightIcon?: React.ReactNode;
  /** Map description text below the label. */
  mapDescription?: string;
  /** When true, show the region availability info box (Instagram). */
  showRegionInfo?: boolean;
  /** Optional callback when number input blurs (e.g. trigger map geocode in dialog). */
  onNumberBlur?: () => void;
  /** When true, show the label (apelido) field above all other fields. */
  showLabelField?: boolean;
}

export function AddressFormWithMap({
  formData,
  setFormData,
  location,
  onLocationChange,
  handleCepBlur,
  fetchingCep,
  states,
  cities,
  neighborhoods,
  statesLoading = false,
  citiesLoading = false,
  neighborhoodsLoading = false,
  onStateChange,
  onCityChange,
  onNeighborhoodChange,
  reverseGeocoding,
  idPrefix = "",
  numberInputRef,
  inputClassName,
  cepRightIcon,
  mapDescription = "Arraste o marcador para ajustar o ponto exato do serviço. Rua e número podem ser atualizados automaticamente.",
  showRegionInfo = false,
  onNumberBlur,
  showLabelField = false,
}: AddressFormWithMapProps) {
  const labelId = idPrefix ? `${idPrefix}label` : "addr-label";
  const zipId = idPrefix ? `${idPrefix}zip` : "addr-zip";
  const streetId = idPrefix ? `${idPrefix}street` : "addr-street";
  const numberId = idPrefix ? `${idPrefix}number` : "addr-number";
  const complementId = idPrefix ? `${idPrefix}complement` : "addr-complement";

  return (
    <>
      {showLabelField && (
        <div className="space-y-2">
          <Label htmlFor={labelId} className={inputClassName ? "text-foreground" : undefined}>
            Apelido
          </Label>
          <Input
            id={labelId}
            value={formData.address_label}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_label: e.target.value }))
            }
            placeholder="Ex.: Casa, Trabalho, Academia..."
            maxLength={50}
            className={inputClassName}
          />
        </div>
      )}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={zipId} className={inputClassName ? "text-foreground" : undefined}>
            CEP
          </Label>
          <Input
            id={zipId}
            value={formData.address_zip}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_zip: maskCEP(e.target.value) }))
            }
            onBlur={handleCepBlur}
            placeholder="00000-000"
            disabled={fetchingCep}
            className={inputClassName}
            rightIcon={cepRightIcon}
          />
        </div>
        <div className="space-y-2">
          <Label className={inputClassName ? "text-foreground" : undefined}>Estado</Label>
          <Select
            value={formData.address_state_id || ""}
            onValueChange={onStateChange}
            disabled={statesLoading || fetchingCep}
          >
            <SelectTrigger className={inputClassName}>
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
        <div className="space-y-2">
          <Label className={inputClassName ? "text-foreground" : undefined}>Cidade</Label>
          <Select
            value={formData.address_city_id || ""}
            onValueChange={onCityChange}
            disabled={!formData.address_state_id || citiesLoading || fetchingCep}
          >
            <SelectTrigger className={inputClassName}>
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
        <div className="space-y-2">
          <Label className={inputClassName ? "text-foreground" : undefined}>Bairro</Label>
          <Select
            value={formData.address_neighborhood_id || ""}
            onValueChange={onNeighborhoodChange}
            disabled={!formData.address_city_id || neighborhoodsLoading || fetchingCep}
          >
            <SelectTrigger className={inputClassName}>
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
        <div className="space-y-2">
          <Label htmlFor={streetId} className={inputClassName ? "text-foreground" : undefined}>
            Rua
          </Label>
          <Input
            id={streetId}
            value={formData.address_street}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_street: e.target.value }))
            }
            placeholder="Rua"
            disabled={fetchingCep}
            className={inputClassName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={numberId} className={inputClassName ? "text-foreground" : undefined}>
            Número
          </Label>
          <Input
            ref={numberInputRef}
            id={numberId}
            value={formData.address_number}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_number: e.target.value }))
            }
            onBlur={onNumberBlur}
            placeholder="Número"
            disabled={fetchingCep}
            className={inputClassName}
          />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label
            htmlFor={complementId}
            className={inputClassName ? "text-foreground" : undefined}
          >
            Complemento
          </Label>
          <Input
            id={complementId}
            value={formData.address_complement}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address_complement: e.target.value }))
            }
            placeholder="Apto, bloco, etc. (opcional)"
            disabled={fetchingCep}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className={inputClassName ? "text-foreground" : undefined}>
          Localização no mapa
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {mapDescription}
        </p>
        {reverseGeocoding && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Buscando endereço...</span>
          </div>
        )}
        <AddressMap
          location={location}
          onLocationChange={onLocationChange}
          className="w-full border border-border rounded-lg"
        />
      </div>

      {showRegionInfo && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 flex gap-2 sm:gap-3">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-muted-foreground">
            Não conseguiu selecionar estado, cidade ou bairro? A Renovi ainda não está presente na
            sua região. Você pode seguir nosso Instagram em{" "}
            <a
              href="https://www.instagram.com/renovi.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              @renovi.com.br
            </a>{" "}
            para acompanhar novidades.
          </p>
        </div>
      )}
    </>
  );
}
