import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, profileApi } from "@/features/auth";
import { supabase } from "@/lib/supabase/client";
import {
  uploadProfileImage,
  removeProfileImageFromStorage,
} from "../api/profileImageStorage.api";
import { toast } from "sonner";
import { ACCOUNT_PROFILE_QUERY_KEY } from "./useAccountProfile";

export function useUploadProfilePhoto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { path, error } = await uploadProfileImage(supabase, user.id, file);
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
      const removeResult = await removeProfileImageFromStorage(supabase, currentPath);
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
