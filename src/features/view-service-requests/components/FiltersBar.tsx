import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import type { ServiceRequestsFilterState } from "../types/service-request-view.types";

export interface FiltersBarProps {
  filters: ServiceRequestsFilterState;
  onCategoryChange: (id: string | null) => void;
  onCityChange: (name: string | null) => void;
  onNeighborhoodChange: (name: string | null) => void;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  onHasProposalsChange: (v: boolean | null) => void;
  onHasImagesChange: (v: boolean | null) => void;
  /** Unique service titles for category dropdown. */
  categoryOptions: string[];
  /** Unique city names for city dropdown. */
  cityOptions: string[];
  /** Unique neighborhood names for neighborhood dropdown. */
  neighborhoodOptions: string[];
  disabled?: boolean;
}

export function FiltersBar({
  filters,
  onCategoryChange,
  onCityChange,
  onNeighborhoodChange,
  onDateRangeChange,
  onHasProposalsChange,
  onHasImagesChange,
  categoryOptions,
  cityOptions,
  neighborhoodOptions,
  disabled,
}: FiltersBarProps) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    filters.categoryId != null ||
    filters.cityName != null ||
    filters.neighborhoodName != null ||
    filters.dateFrom != null ||
    filters.dateTo != null ||
    filters.hasProposals !== null ||
    filters.hasImages !== null;

  const clearFilters = () => {
    onCategoryChange(null);
    onCityChange(null);
    onNeighborhoodChange(null);
    onDateRangeChange(null, null);
    onHasProposalsChange(null);
    onHasImagesChange(null);
  };

  const isDesktop = useBreakpointMd();

  // Lock body scroll when mobile bottom sheet is open
  useEffect(() => {
    if (isDesktop || !open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isDesktop]);

  const filtersFormContent = (
    <div className="space-y-4 overflow-hidden">
      {categoryOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="filter-category">Categoria</Label>
              <select
                id="filter-category"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                value={filters.categoryId ?? ""}
                onChange={(e) =>
                  onCategoryChange(e.target.value || null)
                }
                aria-label="Filtrar por categoria"
              >
                <option value="">Todas</option>
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cityOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="filter-city">Cidade</Label>
              <select
                id="filter-city"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                value={filters.cityName ?? ""}
                onChange={(e) => onCityChange(e.target.value || null)}
                aria-label="Filtrar por cidade"
              >
                <option value="">Todas</option>
                {cityOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {neighborhoodOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="filter-neighborhood">Bairro</Label>
              <select
                id="filter-neighborhood"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                value={filters.neighborhoodName ?? ""}
                onChange={(e) =>
                  onNeighborhoodChange(e.target.value || null)
                }
                aria-label="Filtrar por bairro"
              >
                <option value="">Todos</option>
                {neighborhoodOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Data</Label>
            <div className="flex gap-2">
              <input
                type="date"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  onDateRangeChange(e.target.value || null, filters.dateTo)
                }
                aria-label="Data inicial"
              />
              <input
                type="date"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  onDateRangeChange(filters.dateFrom, e.target.value || null)
                }
                aria-label="Data final"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Orçamentos</Label>
            <select
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
              value={
                filters.hasProposals === null
                  ? ""
                  : filters.hasProposals
                    ? "yes"
                    : "no"
              }
              onChange={(e) => {
                const v = e.target.value;
                onHasProposalsChange(
                  v === "" ? null : v === "yes"
                );
              }}
              aria-label="Filtrar por existência de orçamentos"
            >
              <option value="">Qualquer</option>
              <option value="yes">Com orçamentos</option>
              <option value="no">Sem orçamentos</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Fotos</Label>
            <select
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
              value={
                filters.hasImages === null
                  ? ""
                  : filters.hasImages
                    ? "yes"
                    : "no"
              }
              onChange={(e) => {
                const v = e.target.value;
                onHasImagesChange(v === "" ? null : v === "yes");
              }}
              aria-label="Filtrar por existência de fotos"
            >
              <option value="">Qualquer</option>
              <option value="yes">Com fotos</option>
              <option value="no">Sem fotos</option>
            </select>
          </div>
    </div>
  );

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="Abrir filtros"
    >
      <Filter className="h-4 w-4" aria-hidden />
      Filtros
      {hasActiveFilters && (
        <span className="ml-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
      )}
    </Button>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          className="w-80 max-w-[calc(100vw-2rem)]"
          align="start"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Filtros</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs"
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
            {filtersFormContent}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{triggerButton}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col rounded-t-2xl p-0"
        hideCloseButton={false}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
        <SheetHeader className="shrink-0 flex flex-row items-center justify-between border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-lg font-medium">Filtros</SheetTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {filtersFormContent}
        </div>
        <SheetFooter className="shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button className="w-full" size="lg">
              Aplicar filtros
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
