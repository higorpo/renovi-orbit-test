import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsCardHeader } from "./SettingsCardHeader";
import { Briefcase, Loader2, Search, X } from "lucide-react";
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
    [selectedServiceIds],
  );

  const availableResults = searchServicesList
    .filter((s) => !alreadySelected.has(s.id))
    .slice(0, debouncedQuery ? 20 : 10);

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

  const selectedCountLabel =
    selectedServiceIds.length === 0
      ? "Nenhum selecionado"
      : selectedServiceIds.length === 1
        ? "1 serviço"
        : `${selectedServiceIds.length} serviços`;

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Serviços oferecidos"
          icon={Briefcase}
          description="Tipos de pedido que entram no seu feed"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        <div className="relative w-full">
          <Input
            type="search"
            placeholder="Buscar serviços..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 150)}
            disabled={disabled}
            className="w-full"
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
          />
          {showList && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-canvas py-1 shadow-elevation-2"
              role="listbox"
              aria-label="Resultados da busca"
              onMouseDown={(e) => e.preventDefault()}
            >
              {searchResult.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              ) : availableResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-body">Nenhum serviço encontrado.</p>
              ) : (
                availableResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    onClick={() => addService(s.id)}
                    disabled={disabled}
                    className="flex min-h-11 w-full items-center px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas-soft focus:bg-canvas-soft focus:outline-none"
                  >
                    {s.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-caption text-muted-foreground">{selectedCountLabel}</p>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>

        {selectedServiceIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-canvas-soft px-4 py-8 text-center">
            <p className="text-sm leading-relaxed text-body">
              Nenhum serviço selecionado ainda. Busque acima para receber pedidos desses tipos.
            </p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {selectedServiceIds.map((id) => {
              const title =
                idToTitle.get(id) ?? searchServicesList.find((s) => s.id === id)?.title ?? id;
              const style = getServiceCardStyle(idToStyle.get(id));
              const IconComponent = style.Icon;
              return (
                <li key={id}>
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-canvas pl-2.5 pr-1 text-sm font-medium text-ink">
                    <IconComponent className="h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
                    {title}
                    <button
                      type="button"
                      onClick={() => !disabled && removeService(id)}
                      disabled={disabled}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-canvas-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remover ${title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
