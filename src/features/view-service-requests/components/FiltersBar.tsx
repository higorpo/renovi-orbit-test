import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceRequestsFilterState } from "../types/service-request-view.types";

export interface FiltersBarProps {
  filters: ServiceRequestsFilterState;
  onCategoryChange: (id: string | null) => void;
  onCityChange: (name: string | null) => void;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  onHasProposalsChange: (v: boolean | null) => void;
  onHasImagesChange: (v: boolean | null) => void;
  /** Unique service titles for category dropdown. */
  categoryOptions: string[];
  /** Unique city names for city dropdown. */
  cityOptions: string[];
  disabled?: boolean;
}

export function FiltersBar({
  filters,
  onCategoryChange,
  onCityChange,
  onDateRangeChange,
  onHasProposalsChange,
  onHasImagesChange,
  categoryOptions,
  cityOptions,
  disabled,
}: FiltersBarProps) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    filters.categoryId != null ||
    filters.cityName != null ||
    filters.dateFrom != null ||
    filters.dateTo != null ||
    filters.hasProposals !== null ||
    filters.hasImages !== null;

  const clearFilters = () => {
    onCategoryChange(null);
    onCityChange(null);
    onDateRangeChange(null, null);
    onHasProposalsChange(null);
    onHasImagesChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
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

          <div className="space-y-2">
            <Label>Data</Label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  onDateRangeChange(e.target.value || null, filters.dateTo)
                }
                aria-label="Data inicial"
              />
              <input
                type="date"
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  onDateRangeChange(filters.dateFrom, e.target.value || null)
                }
                aria-label="Data final"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Propostas</Label>
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
              aria-label="Filtrar por existência de propostas"
            >
              <option value="">Qualquer</option>
              <option value="yes">Com propostas</option>
              <option value="no">Sem propostas</option>
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
      </PopoverContent>
    </Popover>
  );
}
