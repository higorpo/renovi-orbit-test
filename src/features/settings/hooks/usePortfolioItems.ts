import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { logger } from "@/lib/logger";
import {
  listPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  reorderPortfolioItems,
  type CreatePortfolioItemParams,
  type UpdatePortfolioItemParams,
  type ProviderPortfolioItem,
} from "../api/providerProfile.api";
import {
  removePortfolioImageFromStorage,
  uploadPortfolioImage,
} from "../api/portfolioImageStorage.api";

const PORTFOLIO_QUERY_KEY = ["provider-portfolio-items"];

export interface CreatePortfolioItemWithImagesParams extends CreatePortfolioItemParams {
  imageFiles?: File[];
}

export interface UpdatePortfolioItemWithImagesParams {
  title: string;
  description?: string | null;
  visibility?: "public" | "private";
  /** Current image paths kept as-is (not removed). */
  existingImagePaths: string[];
  /** Paths to remove from storage and from the item. */
  pathsToRemove: string[];
  /** New files to upload and add to image_paths. */
  imageFiles?: File[];
}

export function usePortfolioItems() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const providerId = profile?.id ?? null;
  const isProvider = profile?.role === "provider";

  const query = useQuery({
    queryKey: [...PORTFOLIO_QUERY_KEY, providerId],
    queryFn: () => listPortfolioItems(providerId!),
    enabled: Boolean(providerId && isProvider),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...PORTFOLIO_QUERY_KEY, providerId] });

  const createMutation = useMutation({
    mutationFn: async (params: CreatePortfolioItemParams) => {
      const r = await createPortfolioItem(providerId!, params);
      if (r.error) throw new Error(r.error);
      return r.data;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      itemId,
      params,
    }: {
      itemId: string;
      params: UpdatePortfolioItemParams;
    }) => {
      const r = await updatePortfolioItem(itemId, providerId!, params);
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const r = await deletePortfolioItem(itemId, providerId!);
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: invalidate,
  });

  /** Deletes DB row first, then storage objects (avoids orphaned rows if DB delete fails). */
  const deleteItemWithStorageCleanup = async (itemId: string) => {
    const items = (query.data?.items ?? []) as ProviderPortfolioItem[];
    const item = items.find((i) => i.id === itemId);
    const paths = (item?.image_paths ?? []) as string[];
    await deleteMutation.mutateAsync(itemId);
    if (paths.length > 0) {
      await Promise.all(
        paths.map((path) => removePortfolioImageFromStorage(path))
      );
    }
  };

  const reorderMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const r = await reorderPortfolioItems(providerId!, itemIds);
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: invalidate,
  });

  const createItemWithImagesAsync = async ({
    imageFiles = [],
    ...params
  }: CreatePortfolioItemWithImagesParams) => {
    if (!providerId) throw new Error("Not authenticated");

    const itemId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      for (let i = 0; i < imageFiles.length; i += 1) {
        const file = imageFiles[i];
        const uploadResult = await uploadPortfolioImage(providerId, itemId, file, i);
        if (uploadResult.error || !uploadResult.path) {
          throw new Error(uploadResult.error ?? "Não foi possível enviar uma imagem do portfólio.");
        }
        uploadedPaths.push(uploadResult.path);
      }

      const created = await createPortfolioItem(providerId, {
        ...params,
        id: itemId,
        image_paths: uploadedPaths,
      });

      if (created.error || !created.data) {
        throw new Error(created.error ?? "Não foi possível criar o item do portfólio.");
      }

      invalidate();
      return { data: created.data, error: null };
    } catch (err) {
      if (uploadedPaths.length > 0) {
        await Promise.all(
          uploadedPaths.map((path) => removePortfolioImageFromStorage(path))
        );
      }
      const message = err instanceof Error ? err.message : "Não foi possível criar o item do portfólio.";
      logger.error("provider_portfolio_create_with_images_error", {
        providerId,
        error: message,
      });
      return { data: null, error: message };
    }
  };

  const updateItemWithImagesAsync = async (
    itemId: string,
    params: UpdatePortfolioItemWithImagesParams
  ) => {
    if (!providerId) throw new Error("Not authenticated");

    const {
      title,
      description,
      visibility,
      existingImagePaths,
      pathsToRemove,
      imageFiles = [],
    } = params;
    const keptPaths = existingImagePaths.filter((p) => !pathsToRemove.includes(p));
    const uploadedPaths: string[] = [];

    try {
      for (let i = 0; i < imageFiles.length; i += 1) {
        const file = imageFiles[i];
        const uploadResult = await uploadPortfolioImage(providerId, itemId, file, i);
        if (uploadResult.error || !uploadResult.path) {
          throw new Error(uploadResult.error ?? "Não foi possível enviar uma imagem do portfólio.");
        }
        uploadedPaths.push(uploadResult.path);
      }

      const finalImagePaths = [...keptPaths, ...uploadedPaths];

      const updateError = await updatePortfolioItem(itemId, providerId, {
        title,
        description: description ?? null,
        visibility,
        image_paths: finalImagePaths,
      });
      if (updateError.error) throw new Error(updateError.error);

      await Promise.all(
        pathsToRemove.map((path) => removePortfolioImageFromStorage(path))
      );

      invalidate();
      return { error: null };
    } catch (err) {
      if (uploadedPaths.length > 0) {
        await Promise.all(
          uploadedPaths.map((path) => removePortfolioImageFromStorage(path))
        );
      }
      const message =
        err instanceof Error ? err.message : "Não foi possível atualizar o item do portfólio.";
      logger.error("provider_portfolio_update_with_images_error", {
        providerId,
        itemId,
        error: message,
      });
      return { error: message };
    }
  };

  return {
    items: (query.data?.items ?? []) as ProviderPortfolioItem[],
    isLoading: query.isLoading,
    error: query.data?.error ?? query.error?.message ?? null,
    refetch: query.refetch,
    createItem: createMutation.mutateAsync,
    createItemWithImages: createItemWithImagesAsync,
    updateItem: updateMutation.mutateAsync,
    updateItemWithImages: updateItemWithImagesAsync,
    deleteItem: deleteItemWithStorageCleanup,
    reorderItems: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
