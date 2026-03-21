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
import { RADIUS_OPTIONS, DEFAULT_RADIUS_KM } from "../constants/sortModes";
import type { ProviderServiceSummary, ProviderJobsFilterState } from "../types/provider-jobs.types";

export interface JobsFiltersBarProps {
  filters: ProviderJobsFilterState;
  onRadiusChange: (km: number) => void;
  onServiceChange: (serviceId: string | null) => void;
  onReset: () => void;
  providerServices: ProviderServiceSummary[];
  disabled?: boolean;
}

export function JobsFiltersBar({
  filters,
  onRadiusChange,
  onServiceChange,
  onReset,
  providerServices,
  disabled,
}: JobsFiltersBarProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useBreakpointMd();

  const hasActiveFilters =
    filters.radiusKm !== DEFAULT_RADIUS_KM ||
    filters.serviceId != null;

  useEffect(() => {
    if (isDesktop || !open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isDesktop]);

  const selectClasses = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  );

  const filtersContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="filter-radius">Raio de busca</Label>
        <select
          id="filter-radius"
          className={selectClasses}
          value={filters.radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          aria-label="Raio de busca em km"
        >
          {RADIUS_OPTIONS.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </div>

      {providerServices.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="filter-service">Tipo de serviço</Label>
          <select
            id="filter-service"
            className={selectClasses}
            value={filters.serviceId ?? ""}
            onChange={(e) => onServiceChange(e.target.value || null)}
            aria-label="Filtrar por tipo de serviço"
          >
            <option value="">Todos os serviços</option>
            {providerServices.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.title}
              </option>
            ))}
          </select>
        </div>
      )}
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
          className="w-72 max-w-[calc(100vw-2rem)]"
          align="start"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Filtros</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-8 text-xs"
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
            {filtersContent}
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
        <div
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
          aria-hidden
        />
        <SheetHeader className="shrink-0 flex flex-row items-center justify-between border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-lg font-medium">Filtros</SheetTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {filtersContent}
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
