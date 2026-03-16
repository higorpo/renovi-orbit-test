import { Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            {address.label && (
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{address.label}</span>
                {isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Padrão
                  </Badge>
                )}
              </div>
            )}
            {!address.label && isDefault && (
              <Badge variant="secondary" className="mb-1 text-xs">Padrão</Badge>
            )}
            <p className="text-sm text-muted-foreground">{line}</p>
            {cityStateStr && (
              <p className="text-sm text-muted-foreground">{cityStateStr}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(address.id)}
              aria-label="Editar endereço"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            {!isDefault && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSetDefault(address.id)}
                disabled={isSettingDefault}
                aria-label="Definir como padrão"
              >
                <Star className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDelete(address.id)}
              disabled={isDeleting}
              aria-label="Excluir endereço"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
