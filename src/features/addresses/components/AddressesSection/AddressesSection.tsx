import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientAddressWithRelations } from "../../types/addresses.types";
import { useAddressesList } from "../../hooks/useAddressesList";
import { useSetDefaultAddress, useDeleteAddress } from "../../hooks/useAddressMutations";
import { AddressCard } from "../AddressCard/AddressCard";
import { AddressFormDialog } from "../AddressFormDialog/AddressFormDialog";
import { DeleteAddressDialog } from "../DeleteAddressDialog/DeleteAddressDialog";

export interface AddressesSectionProps {
  /** Optional card header class (e.g. for settings compact style). */
  cardHeaderClassName?: string;
  /** Optional section title size. */
  titleSize?: "default" | "compact";
}

export function AddressesSection({
  cardHeaderClassName = "pb-1.5 sm:pb-2",
  titleSize = "compact",
}: AddressesSectionProps) {
  const { addresses, isLoading, error, refetch } = useAddressesList();
  const { setDefault, isSettingDefault } = useSetDefaultAddress();
  const { deleteAddress: deleteAddressMutation, isDeleting: isDeletingAddress } =
    useDeleteAddress();

  const [addEditDialogOpen, setAddEditDialogOpen] = useState(false);
  const [addEditMode, setAddEditMode] = useState<"add" | "edit">("add");
  const [addEditAddress, setAddEditAddress] = useState<ClientAddressWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAddress, setDeleteAddressState] = useState<ClientAddressWithRelations | null>(null);

  const handleAddAddress = () => {
    setAddEditMode("add");
    setAddEditAddress(null);
    setAddEditDialogOpen(true);
  };

  const handleEditAddress = (addr: ClientAddressWithRelations) => {
    setAddEditMode("edit");
    setAddEditAddress(addr);
    setAddEditDialogOpen(true);
  };

  const handleDeleteAddressClick = (addr: ClientAddressWithRelations) => {
    setDeleteAddressState(addr);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteAddress) {
      deleteAddressMutation(deleteAddress.id);
      setDeleteDialogOpen(false);
      setDeleteAddressState(null);
    }
  };

  const handleAddEditSuccess = () => {
    setAddEditDialogOpen(false);
    setAddEditAddress(null);
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className={cardHeaderClassName}>
          <SectionTitleWithIcon
            title="Endereços"
            icon={MapPin}
            iconGradient="from-amber-500 to-orange-500"
            size={titleSize}
            className="!mb-0"
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className={cardHeaderClassName}>
          <SectionTitleWithIcon
            title="Endereços"
            icon={MapPin}
            iconGradient="from-amber-500 to-orange-500"
            size={titleSize}
            className="!mb-0"
          />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Não foi possível carregar os endereços.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className={cardHeaderClassName}>
          <SectionTitleWithIcon
            title="Endereços"
            icon={MapPin}
            iconGradient="from-amber-500 to-orange-500"
            subtitle="Gerencie seus endereços de atendimento."
            size={titleSize}
            className="!mb-0"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddAddress}
            aria-label="Adicionar endereço"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar endereço
          </Button>
          {addresses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum endereço cadastrado. Adicione um para usar em seus pedidos.
            </p>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {addresses.map((addr) => (
                <li key={addr.id}>
                  <AddressCard
                    address={addr}
                    onEdit={(id) => {
                      const a = addresses.find((x) => x.id === id);
                      if (a) handleEditAddress(a);
                    }}
                    onDelete={(id) => {
                      const a = addresses.find((x) => x.id === id);
                      if (a) handleDeleteAddressClick(a);
                    }}
                    onSetDefault={setDefault}
                    isDeleting={isDeletingAddress}
                    isSettingDefault={isSettingDefault}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddressFormDialog
        open={addEditDialogOpen}
        mode={addEditMode}
        address={addEditAddress}
        onClose={() => {
          setAddEditDialogOpen(false);
          setAddEditAddress(null);
        }}
        onSuccess={handleAddEditSuccess}
      />

      <DeleteAddressDialog
        open={deleteDialogOpen}
        address={deleteAddress}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteAddressState(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
