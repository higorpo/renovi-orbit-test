import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { updateAddress, deleteAddress } from "../api/addresses.api";
import { toast } from "sonner";
import { ADDRESSES_LIST_QUERY_KEY } from "./useAddressesList";

export function useSetDefaultAddress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clientId = user?.id ?? "";

  const mutation = useMutation({
    mutationFn: async (addressId: string) => {
      const result = await updateAddress(addressId, clientId, { is_default: true });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_LIST_QUERY_KEY });
      toast.success("Endereço padrão atualizado.");
    },
    onError: () => {
      toast.error("Não foi possível definir o endereço padrão.");
    },
  });

  return {
    setDefault: mutation.mutate,
    setDefaultAsync: mutation.mutateAsync,
    isSettingDefault: mutation.isPending,
  };
}

export function useDeleteAddress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clientId = user?.id ?? "";

  const mutation = useMutation({
    mutationFn: async (addressId: string) => {
      const result = await deleteAddress(addressId, clientId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_LIST_QUERY_KEY });
      toast.success("Endereço excluído.");
    },
    onError: () => {
      toast.error("Não foi possível excluir o endereço.");
    },
  });

  return {
    deleteAddress: mutation.mutate,
    deleteAddressAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
}
