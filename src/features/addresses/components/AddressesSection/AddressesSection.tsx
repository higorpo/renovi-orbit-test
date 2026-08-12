import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientAddressWithRelations } from "../../types/addresses.types";
import { useAddressesList } from "../../hooks/useAddressesList";
import { useSetDefaultAddress, useDeleteAddress } from "../../hooks/useAddressMutations";
import { AddressCard } from "../AddressCard/AddressCard";
import { AddressFormDialog } from "../AddressFormDialog/AddressFormDialog";
import { DeleteAddressDialog } from "../DeleteAddressDialog/DeleteAddressDialog";

/**
 * Address list for the settings hub. Page title lives in SettingsSectionHeader /
 * mobile stack chrome — this section only renders the list + actions.
 */
export function AddressesSection() {
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

  const dialogs = (
    <>
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

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando endereços">
        <Skeleton className="h-10 w-44 rounded-full" />
        <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
        <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-5">
        <p className="text-sm text-destructive">Não foi possível carregar os endereços.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 rounded-full"
          onClick={() => refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground">
            {addresses.length === 0
              ? "Nenhum cadastrado"
              : addresses.length === 1
                ? "1 endereço"
                : `${addresses.length} endereços`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleAddAddress}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar endereço
          </Button>
        </div>

        {addresses.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-canvas-soft px-6 py-12 text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
              aria-hidden
            >
              <MapPin className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <p className="font-display text-base font-semibold tracking-tight text-ink">
              Nenhum endereço ainda
            </p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-body">
              Adicione um local para usar nos seus pedidos de serviço.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
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
      </div>
      {dialogs}
    </>
  );
}
