import { useState, useMemo, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
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

export function ServiceAreaField({ form, disabled }: ServiceAreaFieldProps) {
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

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="service_area_neighborhood_ids"
        render={() => (
          <FormItem>
            <FormLabel>Cidades e bairros de atuação</FormLabel>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Adicione as cidades e os bairros em que você atende. Você pode atuar em mais de uma cidade.
              </p>

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
                      className="gap-2"
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
                    className="gap-2"
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

              {neighborhoodIds.length > 0 && (
                <div className="space-y-3 pt-2">
                  {Array.from(groupedByCity.entries()).map(([cityId, { cityName, stateAbbr, items }]) => (
                      <div key={cityId} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {cityName}
                            {stateAbbr ? `, ${stateAbbr}` : ""}
                          </span>
                          <div className="flex items-center gap-1">
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
                                  className="h-7 text-xs gap-1"
                                  disabled={disabled}
                                  onClick={() => openEditCity(cityId)}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Alterar bairros
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 min-w-[280px] p-0" align="start">
                                <div>
                                  <div className="p-3">
                                    <p className="text-sm font-medium">
                                      {cityName}
                                      {stateAbbr ? `, ${stateAbbr}` : ""}
                                    </p>
                                    <p className="text-xs text-muted-foreground pt-2">
                                      Selecione os bairros em que você atende nesta cidade.
                                    </p>
                                  </div>
                                  <Command className="border-t rounded-t-none">
                                    <CommandInput placeholder="Buscar bairro..." />
                                    <CommandList className="max-h-[200px]">
                                      <CommandEmpty>
                                        {neighborhoodsForEditQuery.isLoading ? (
                                          <span className="flex items-center gap-2 py-2 justify-center">
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
                                  <div className="flex gap-2 px-3 pb-3">
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
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="flex-1"
                                      onClick={saveEditCity}
                                    >
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={disabled}
                              onClick={() => removeAllInCity(cityId)}
                            >
                              Remover todos
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((n) => (
                            <Badge
                              key={n.id}
                              variant="secondary"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                            >
                              {n.name}
                              <button
                                type="button"
                                onClick={() => !disabled && removeNeighborhood(n.id)}
                                disabled={disabled}
                                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full -mr-0.5 text-secondary-foreground hover:bg-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-secondary"
                                aria-label={`Remover ${n.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
