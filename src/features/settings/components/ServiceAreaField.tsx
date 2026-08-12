import { useState, useMemo, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SettingsCardHeader } from "./SettingsCardHeader";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Loader2, MapPin, Pencil, Plus, X } from "lucide-react";
import {
  searchCities,
  listNeighborhoodsByCity,
  getNeighborhoodsByIds,
} from "@/features/addresses";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import type { ProviderAccountFormData } from "../types/providerAccountForm.validation";

export interface ServiceAreaFieldProps {
  form: UseFormReturn<ProviderAccountFormData>;
  disabled?: boolean;
  /** Hide the field label when a parent card already titles the section. */
  hideLabel?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

function groupByCity<T extends { city_id: string; city_name: string; state_abbreviation: string }>(
  items: T[]
): Map<string, { cityName: string; stateAbbr: string; items: T[] }> {
  const map = new Map<string, { cityName: string; stateAbbr: string; items: T[] }>();
  for (const item of items) {
    const key = item.city_id;
    if (!map.has(key)) {
      map.set(key, { cityName: item.city_name, stateAbbr: item.state_abbreviation, items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return map;
}

export function ServiceAreaField({ form, disabled, hideLabel }: ServiceAreaFieldProps) {
  const neighborhoodIds = form.watch("service_area_neighborhood_ids") ?? [];
  const isDesktop = useBreakpointMd();

  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [debouncedCityQuery, setDebouncedCityQuery] = useState("");
  const [selectedCityIdForAdd, setSelectedCityIdForAdd] = useState<string | null>(null);
  const [selectedNeighborhoodIdsForAdd, setSelectedNeighborhoodIdsForAdd] = useState<string[]>([]);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [editNeighborhoodIds, setEditNeighborhoodIds] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCityQuery(cityQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityQuery]);

  const citiesQuery = useQuery({
    queryKey: ["search-cities", debouncedCityQuery],
    queryFn: () => searchCities(debouncedCityQuery.trim()),
    enabled: addPopoverOpen && debouncedCityQuery.trim().length > 0,
  });

  const neighborhoodsForAddQuery = useQuery({
    queryKey: ["neighborhoods-by-city", selectedCityIdForAdd],
    queryFn: () => listNeighborhoodsByCity(selectedCityIdForAdd!),
    enabled: Boolean(selectedCityIdForAdd),
  });

  const neighborhoodsForEditQuery = useQuery({
    queryKey: ["neighborhoods-by-city", editingCityId],
    queryFn: () => listNeighborhoodsByCity(editingCityId!),
    enabled: Boolean(editingCityId),
  });

  const existingNeighborhoodsQuery = useQuery({
    queryKey: ["neighborhoods-by-ids", neighborhoodIds],
    queryFn: () => getNeighborhoodsByIds(neighborhoodIds),
    enabled: neighborhoodIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });

  const cities = useMemo(
    () => citiesQuery.data?.cities ?? [],
    [citiesQuery.data?.cities]
  );
  const neighborhoodsForAdd = useMemo(
    () => neighborhoodsForAddQuery.data?.neighborhoods ?? [],
    [neighborhoodsForAddQuery.data?.neighborhoods]
  );
  const neighborhoodsForEdit = useMemo(
    () => neighborhoodsForEditQuery.data?.neighborhoods ?? [],
    [neighborhoodsForEditQuery.data?.neighborhoods]
  );
  const existingWithCity = useMemo(
    () => existingNeighborhoodsQuery.data?.neighborhoods ?? [],
    [existingNeighborhoodsQuery.data?.neighborhoods]
  );

  const existingCityIds = useMemo(
    () => new Set(existingWithCity.map((n) => n.city_id)),
    [existingWithCity]
  );

  const cityOptions = useMemo(
    () =>
      cities
        .filter((c) => !existingCityIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: c.state_abbreviation ? `${c.name}, ${c.state_abbreviation}` : c.name,
        })),
    [cities, existingCityIds]
  );

  const neighborhoodOptionsForAdd = useMemo(
    () => neighborhoodsForAdd.map((n) => ({ value: n.id, label: n.name })),
    [neighborhoodsForAdd]
  );

  const neighborhoodOptionsForEdit = useMemo(
    () => neighborhoodsForEdit.map((n) => ({ value: n.id, label: n.name })),
    [neighborhoodsForEdit]
  );

  const groupedByCity = useMemo(() => groupByCity(existingWithCity), [existingWithCity]);

  const addNeighborhoodsToForm = () => {
    const toAdd = selectedNeighborhoodIdsForAdd.filter((id) => !neighborhoodIds.includes(id));
    if (toAdd.length === 0) return;
    form.setValue("service_area_neighborhood_ids", [...neighborhoodIds, ...toAdd], {
      shouldDirty: true,
    });
    setSelectedCityIdForAdd(null);
    setSelectedNeighborhoodIdsForAdd([]);
    setCityQuery("");
    setAddPopoverOpen(false);
  };

  const toggleNeighborhoodForAdd = (id: string) => {
    setSelectedNeighborhoodIdsForAdd((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const removeNeighborhood = (id: string) => {
    form.setValue(
      "service_area_neighborhood_ids",
      neighborhoodIds.filter((n) => n !== id),
      { shouldDirty: true }
    );
  };

  const removeAllInCity = (cityId: string) => {
    const group = groupedByCity.get(cityId);
    if (!group) return;
    const idsToRemove = new Set(group.items.map((i) => i.id));
    form.setValue(
      "service_area_neighborhood_ids",
      neighborhoodIds.filter((n) => !idsToRemove.has(n)),
      { shouldDirty: true }
    );
  };

  const openEditCity = (cityId: string) => {
    const group = groupedByCity.get(cityId);
    setEditingCityId(cityId);
    setEditNeighborhoodIds(group ? group.items.map((i) => i.id) : []);
  };

  const saveEditCity = () => {
    if (!editingCityId) return;
    const group = groupedByCity.get(editingCityId);
    const idsInThisCity = group ? new Set(group.items.map((i) => i.id)) : new Set<string>();
    const otherIds = neighborhoodIds.filter((n) => !idsInThisCity.has(n));
    form.setValue("service_area_neighborhood_ids", [...otherIds, ...editNeighborhoodIds], {
      shouldDirty: true,
    });
    setEditingCityId(null);
    setEditNeighborhoodIds([]);
  };

  const toggleNeighborhoodForEdit = (id: string) => {
    setEditNeighborhoodIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedCityLabel = selectedCityIdForAdd
    ? cityOptions.find((o) => o.value === selectedCityIdForAdd)?.label ??
      cities.find((c) => c.id === selectedCityIdForAdd)?.name ??
      "Cidade"
    : null;

  const addCityContent = (
    <div className="space-y-2">
      {!selectedCityIdForAdd ? (
        <>
          <p className="hidden md:block text-sm font-medium pt-2 pl-3">Pesquisar cidade</p>
          <Command shouldFilter={false} className="md:border-t md:rounded-t-none">
            <CommandInput
              placeholder="Digite o nome da cidade..."
              value={cityQuery}
              onValueChange={setCityQuery}
            />
            <CommandList className="my-2">
              <CommandEmpty>
                {citiesQuery.isLoading ? (
                  <span className="flex items-center gap-2 py-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  "Nenhuma cidade encontrada."
                )}
              </CommandEmpty>
              <CommandGroup>
                {cityOptions.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      setSelectedCityIdForAdd(opt.value);
                      setSelectedNeighborhoodIdsForAdd([]);
                    }}
                    className="cursor-pointer"
                  >
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </>
      ) : (
        <>
          <div className="pl-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{selectedCityLabel}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCityIdForAdd(null);
                  setSelectedNeighborhoodIdsForAdd([]);
                }}
              >
                Trocar cidade
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione os bairros em que você atende nesta cidade.
            </p>
          </div>
          <Command className="border-t rounded-t-none">
            <CommandInput placeholder="Buscar bairro..." />
            <CommandList className="max-h-[200px] mt-2">
              <CommandEmpty>
                {neighborhoodsForAddQuery.isLoading ? (
                  <span className="flex items-center gap-2 py-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  "Nenhum bairro encontrado."
                )}
              </CommandEmpty>
              <CommandGroup>
                {neighborhoodOptionsForAdd.map((opt) => {
                  const isSelected = selectedNeighborhoodIdsForAdd.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => toggleNeighborhoodForAdd(opt.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 shrink-0 ${
                          isSelected ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="px-2 pt-2 md:pb-2 border-t">
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={selectedNeighborhoodIdsForAdd.length === 0}
              onClick={addNeighborhoodsToForm}
            >
              Adicionar {selectedNeighborhoodIdsForAdd.length} bairro(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const editingGroup = editingCityId ? groupedByCity.get(editingCityId) : null;
  const editCityContent = (
    <div>
      <div className="p-3">
        <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
          {editingGroup
            ? `${editingGroup.cityName}${editingGroup.stateAbbr ? `, ${editingGroup.stateAbbr}` : ""}`
            : "Bairros"}
        </p>
        <p className="pt-2 text-sm text-body">
          Selecione os bairros em que você atende nesta cidade.
        </p>
      </div>
      <Command className="rounded-t-none border-t">
        <CommandInput placeholder="Buscar bairro..." />
        <CommandList className="max-h-[200px]">
          <CommandEmpty>
            {neighborhoodsForEditQuery.isLoading ? (
              <span className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </span>
            ) : (
              "Nenhum bairro encontrado."
            )}
          </CommandEmpty>
          <CommandGroup>
            {neighborhoodOptionsForEdit.map((opt) => {
              const isSelected = editNeighborhoodIds.includes(opt.value);
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggleNeighborhoodForEdit(opt.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${
                      isSelected ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {opt.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex gap-2 px-3 pb-3 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => {
            setEditingCityId(null);
            setEditNeighborhoodIds([]);
          }}
        >
          Cancelar
        </Button>
        <Button type="button" size="sm" className="flex-1" onClick={saveEditCity}>
          Salvar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="service_area_neighborhood_ids"
        render={() => (
          <FormItem>
            {hideLabel ? null : (
              <>
                <FormLabel>Cidades e bairros de atuação</FormLabel>
                <p className="text-sm leading-relaxed text-body">
                  Adicione as cidades e os bairros em que você atende. Você pode atuar em mais de uma
                  cidade.
                </p>
              </>
            )}
            <div className="space-y-3">

              {isDesktop ? (
                <Popover
                  open={addPopoverOpen}
                  onOpenChange={(open) => {
                    setAddPopoverOpen(open);
                    if (!open) {
                      setSelectedCityIdForAdd(null);
                      setSelectedNeighborhoodIdsForAdd([]);
                      setCityQuery("");
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      className="min-h-11 gap-2 rounded-full sm:min-h-9"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar cidade
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 min-w-[280px] p-0" align="start">
                    {addCityContent}
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className="min-h-11 gap-2 rounded-full sm:min-h-9"
                    onClick={() => setAddPopoverOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar cidade
                  </Button>
                  <Drawer
                    open={addPopoverOpen}
                    onOpenChange={(open) => {
                      setAddPopoverOpen(open);
                      if (!open) {
                        setSelectedCityIdForAdd(null);
                        setSelectedNeighborhoodIdsForAdd([]);
                        setCityQuery("");
                      }
                    }}
                    shouldScaleBackground={false}
                    handleOnly
                  >
                      <DrawerContent
                        aria-describedby={undefined}
                        className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0"
                      >
                      <DrawerHeader className="shrink-0 border-b px-4 pb-3 pt-1 text-left">
                        <DrawerTitle>
                          {!selectedCityIdForAdd ? "Adicionar cidade" : "Selecionar bairros"}
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-y-contain pb-[max(1rem,env(safe-area-inset-bottom))] -mt-[20px]">
                        {addCityContent}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              )}

              {neighborhoodIds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-canvas-soft px-4 py-8 text-center">
                  <p className="text-sm leading-relaxed text-body">
                    Nenhuma cidade adicionada. Inclua onde você atende para aparecer nas buscas da
                    região.
                  </p>
                </div>
              ) : (
                <ul className="m-0 list-none space-y-3 p-0 pt-1">
                  {Array.from(groupedByCity.entries()).map(
                    ([cityId, { cityName, stateAbbr, items }]) => (
                      <li key={cityId}>
                        <article className="rounded-2xl border border-border bg-canvas p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-ink"
                              aria-hidden
                            >
                              <MapPin className="h-5 w-5" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                                  {cityName}
                                  {stateAbbr ? `, ${stateAbbr}` : ""}
                                </p>
                                <div className="flex flex-wrap items-center gap-1">
                                  {isDesktop ? (
                                    <Popover
                                      open={editingCityId === cityId}
                                      onOpenChange={(open) => {
                                        if (!open) {
                                          setEditingCityId(null);
                                          setEditNeighborhoodIds([]);
                                        }
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-9 gap-1 rounded-full text-sm"
                                          disabled={disabled}
                                          onClick={() => openEditCity(cityId)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          Alterar bairros
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-80 min-w-[280px] p-0"
                                        align="start"
                                      >
                                        {editingCityId === cityId ? editCityContent : null}
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-9 gap-1 rounded-full text-sm"
                                      disabled={disabled}
                                      onClick={() => openEditCity(cityId)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Alterar bairros
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 rounded-full text-sm text-body hover:text-destructive"
                                    disabled={disabled}
                                    onClick={() => removeAllInCity(cityId)}
                                  >
                                    Remover todos
                                  </Button>
                                </div>
                              </div>
                              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                                {items.map((n) => (
                                  <li key={n.id}>
                                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-canvas-soft pl-2.5 pr-1 text-sm font-medium text-ink">
                                      {n.name}
                                      <button
                                        type="button"
                                        onClick={() => !disabled && removeNeighborhood(n.id)}
                                        disabled={disabled}
                                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={`Remover ${n.name}`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </article>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {!isDesktop ? (
        <Drawer
          open={editingCityId != null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingCityId(null);
              setEditNeighborhoodIds([]);
            }
          }}
          shouldScaleBackground={false}
          handleOnly
        >
          <DrawerContent
            aria-describedby={undefined}
            className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0"
          >
            <DrawerHeader className="shrink-0 border-b px-4 pb-3 pt-1 text-left">
              <DrawerTitle>Alterar bairros</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y pb-[max(1rem,env(safe-area-inset-bottom))]">
              {editCityContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}

export function ServiceAreaSection({ form, disabled }: Omit<ServiceAreaFieldProps, "hideLabel">) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Área de atuação"
          icon={MapPin}
          description="Cidades e bairros em que você atende. Você pode atuar em mais de uma cidade."
        />
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        <ServiceAreaField form={form} disabled={disabled} hideLabel />
      </CardContent>
    </Card>
  );
}
