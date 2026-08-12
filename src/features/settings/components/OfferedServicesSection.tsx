import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCardHeader } from "./SettingsCardHeader";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";
import { getServiceCardStyle } from "@/features/request-quote";
import { searchServices, getServicesByIds } from "../api/providerProfile.api";

export interface OfferedServicesSectionProps {
  selectedServiceIds: string[];
  onSelectedChange: (ids: string[]) => void;
  setServiceIdsAsync: (ids: string[]) => Promise<unknown>;
  isUpdating: boolean;
  disabled?: boolean;
}

export function OfferedServicesSection({
  selectedServiceIds,
  onSelectedChange,
  setServiceIdsAsync,
  isUpdating,
  disabled,
}: OfferedServicesSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const debouncedQuery = searchQuery.trim();
  const showList = Boolean(debouncedQuery || isInputFocused);

  const searchResult = useQuery({
    queryKey: ["services-search", debouncedQuery],
    queryFn: () => searchServices(debouncedQuery || " "),
    enabled: showList,
    staleTime: 5 * 60 * 1000,
  });

  const selectedTitlesQuery = useQuery({
    queryKey: ["services-by-ids", selectedServiceIds],
    queryFn: () => getServicesByIds(selectedServiceIds),
    enabled: selectedServiceIds.length > 0,
  });

  const idToTitle = useMemo(() => {
    const list = selectedTitlesQuery.data?.services ?? [];
    return new Map(list.map((s) => [s.id, s.title]));
  }, [selectedTitlesQuery.data?.services]);

  const idToStyle = useMemo(() => {
    const m = new Map<string, { icon_key: string | null; color_key: string | null }>();
    for (const s of selectedTitlesQuery.data?.services ?? []) {
      m.set(s.id, { icon_key: s.icon_key ?? null, color_key: s.color_key ?? null });
    }
    for (const s of searchResult.data?.services ?? []) {
      m.set(s.id, { icon_key: s.icon_key ?? null, color_key: s.color_key ?? null });
    }
    return m;
  }, [selectedTitlesQuery.data?.services, searchResult.data?.services]);

  const searchServicesList = searchResult.data?.services ?? [];
  const alreadySelected = useMemo(
    () => new Set(selectedServiceIds),
    [selectedServiceIds]
  );

  const addService = (id: string) => {
    if (alreadySelected.has(id)) return;
    const next = [...selectedServiceIds, id];
    onSelectedChange(next);
    setServiceIdsAsync(next).catch(() => {});
  };

  const removeService = (id: string) => {
    const next = selectedServiceIds.filter((s) => s !== id);
    onSelectedChange(next);
    setServiceIdsAsync(next).catch(() => {});
  };

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-2">
        <SettingsCardHeader
          title="Serviços oferecidos"
          icon={Search}
          description="Pesquise e selecione os serviços que aparecem no seu perfil público"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="relative w-full">
          <Input
            placeholder="Buscar serviços..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 150)}
            disabled={disabled}
            className="w-full"
          />
          {showList && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 divide-y overflow-y-auto rounded-xl border border-border bg-canvas shadow-elevation-2"
              role="listbox"
              aria-label="Resultados da busca"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searchResult.isLoading ? (
                <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              ) : (
                searchServicesList
                  .filter((s) => !alreadySelected.has(s.id))
                  .slice(0, debouncedQuery ? 20 : 10)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      onClick={() => addService(s.id)}
                      disabled={disabled}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                    >
                      {s.title}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
        {selectedServiceIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedServiceIds.map((id) => {
              const title = idToTitle.get(id) ?? searchServicesList.find((s) => s.id === id)?.title ?? id;
              const style = getServiceCardStyle(idToStyle.get(id));
              const IconComponent = style.Icon;
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                >
                  <IconComponent className="h-3.5 w-3.5 shrink-0 text-secondary-foreground" aria-hidden />
                  {title}
                  <button
                    type="button"
                    onClick={() => !disabled && removeService(id)}
                    disabled={disabled}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full -mr-0.5 text-secondary-foreground hover:bg-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-secondary"
                    aria-label={`Remover ${title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
            {isUpdating && <Loader2 className="h-4 w-4 animate-spin self-center ml-3 text-muted-foreground" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
