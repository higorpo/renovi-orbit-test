import { MapPin, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientAddressWithRelations } from "../../types/addresses.types";

export interface AddressCardProps {
  address: ClientAddressWithRelations;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  isDeleting?: boolean;
  isSettingDefault?: boolean;
}

function formatAddressLine(addr: ClientAddressWithRelations): string {
  const parts = [
    addr.street,
    addr.number,
    addr.complement,
    addr.neighborhood,
    addr.zip_code,
  ].filter(Boolean);
  return parts.join(", ");
}

function cityState(addr: ClientAddressWithRelations): string {
  const city = addr.platform_cities?.name ?? "";
  const state = addr.platform_states?.abbreviation ?? "";
  return [city, state].filter(Boolean).join(" - ");
}

export function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting,
  isSettingDefault,
}: AddressCardProps) {
  const isDefault = address.is_default;
  const line = formatAddressLine(address);
  const cityStateStr = cityState(address);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-canvas p-4 shadow-sm transition-colors duration-150",
        "sm:p-5",
        isDefault && "border-ink/15 bg-canvas-soft",
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
          aria-hidden
        >
          <MapPin className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {address.label ? (
              <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                {address.label}
              </h3>
            ) : null}
            {isDefault ? (
              <Badge
                variant="secondary"
                className="rounded-full border-0 bg-ink px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
              >
                Padrão
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-body">{line}</p>
          {cityStateStr ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{cityStateStr}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-body hover:bg-primary-soft hover:text-ink"
            onClick={() => onEdit(address.id)}
            aria-label="Editar endereço"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          {!isDefault ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-body hover:bg-primary-soft hover:text-ink"
              onClick={() => onSetDefault(address.id)}
              disabled={isSettingDefault}
              aria-label="Definir como padrão"
            >
              <Star className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-body hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(address.id)}
            disabled={isDeleting}
            aria-label="Excluir endereço"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}
