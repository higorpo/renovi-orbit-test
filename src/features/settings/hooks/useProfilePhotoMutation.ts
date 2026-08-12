import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, profileApi } from "@/features/auth";
import {
  uploadProfileImage,
  removeProfileImageFromStorage,
} from "../api/profileImageStorage.api";
import { toast } from "sonner";
import { ACCOUNT_PROFILE_QUERY_KEY } from "./useAccountProfile";

export function useUploadProfilePhoto() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      const cached = queryClient.getQueryData<{
        profile?: { profile_image_path?: string | null } | null;
      }>([...ACCOUNT_PROFILE_QUERY_KEY, user.id]);
      const previousPath =
        cached?.profile?.profile_image_path ?? profile?.profile_image_path ?? null;

      const { path, error } = await uploadProfileImage(user.id, file, { previousPath });
      if (error) throw new Error(error);
      if (!path) throw new Error("Upload failed");
      const updateResult = await profileApi.updateProfile(user.id, {
        profile_image_path: path,
      });
      if (updateResult.error) throw new Error(updateResult.error);
      return path;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_QUERY_KEY });
      toast.success("Foto atualizada com sucesso.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível enviar a foto.");
    },
  });

  return {
    uploadPhoto: mutation.mutate,
    uploadPhotoAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
  };
}

export function useRemoveProfilePhoto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (currentPath: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const removeResult = await removeProfileImageFromStorage(currentPath);
      if (removeResult.error) throw new Error(removeResult.error);
      const updateResult = await profileApi.updateProfile(user.id, {
        profile_image_path: null,
      });
      if (updateResult.error) throw new Error(updateResult.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PROFILE_QUERY_KEY });
      toast.success("Foto removida.");
    },
    onError: () => {
      toast.error("Não foi possível remover a foto.");
    },
  });

  return {
    removePhoto: mutation.mutate,
    removePhotoAsync: mutation.mutateAsync,
    isRemoving: mutation.isPending,
  };
}
