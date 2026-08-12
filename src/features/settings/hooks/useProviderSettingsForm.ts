import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/features/auth";
import { useUpdateAccountProfile } from "./useUpdateAccountProfile";
import { useProviderProfile } from "./useProviderProfile";
import { useUpdateProviderProfile } from "./useUpdateProviderProfile";
import { useUploadProfilePhoto, useRemoveProfilePhoto } from "./useProfilePhotoMutation";
import { useOfferedServices } from "./useOfferedServices";
import { usePortfolioItems } from "./usePortfolioItems";
import {
  providerAccountFormSchema,
  type ProviderAccountFormData,
} from "../types/providerAccountForm.validation";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

function buildProfileUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/perfil/${slug}`;
}

/** Shared provider account form + autosave used by hub section pages. */
export function useProviderSettingsForm() {
  const { user } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    error: profileError,
    privateData,
    publicData,
    refetch,
  } = useProviderProfile();
  const { updateProfileAsync, isUpdating: isUpdatingProfile } = useUpdateAccountProfile({
    silent: true,
  });
  const {
    updatePrivateAsync,
    updatePublicAsync,
    isUpdatingPrivate,
    isUpdatingPublic,
  } = useUpdateProviderProfile();
  const { uploadPhotoAsync, isUploading } = useUploadProfilePhoto();
  const { removePhotoAsync, isRemoving } = useRemoveProfilePhoto();
  const { serviceIds, setServiceIds, isUpdating: isUpdatingServices } = useOfferedServices();
  const {
    items: portfolioItems,
    createItemWithImages,
    updateItemWithImages,
    deleteItem,
    reorderItems,
    isCreating: isCreatingPortfolio,
    isUpdating: isUpdatingPortfolio,
    isDeleting: isDeletingPortfolio,
  } = usePortfolioItems();

  const [offeredServiceIds, setOfferedServiceIds] = useState<string[]>(serviceIds);

  const defaultValues = useMemo<ProviderAccountFormData>(
    () => ({
      full_name: profile?.full_name?.trim() ?? "",
      phone: profile?.phone ?? "",
      entity_type: (privateData?.entity_type as "pf" | "pj") ?? "pf",
      display_name: publicData?.display_name ?? "",
      bio: publicData?.bio ?? "",
      profile_visibility:
        (publicData?.profile_visibility as "public" | "restricted") ?? "restricted",
      service_area_city: publicData?.service_area_city ?? "",
      service_area_neighborhood_ids: publicData?.service_area_neighborhood_ids ?? [],
      cpf: privateData?.cpf ?? "",
      cnpj: privateData?.cnpj ?? "",
      razao_social: privateData?.razao_social ?? "",
      nome_fantasia: privateData?.nome_fantasia ?? "",
      legal_representative_name: privateData?.legal_representative_name ?? "",
      legal_representative_cpf: privateData?.legal_representative_cpf ?? "",
      commercial_contact: privateData?.commercial_contact ?? "",
    }),
    [profile, privateData, publicData],
  );

  const form = useForm<ProviderAccountFormData>({
    defaultValues,
  });

  const hydratedProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    if (hydratedProfileIdRef.current === profile.id) return;
    if (!profileLoading) {
      form.reset(defaultValues);
      hydratedProfileIdRef.current = profile.id;
    }
  }, [profile?.id, profileLoading, defaultValues, form]);

  useEffect(() => {
    setOfferedServiceIds(serviceIds);
  }, [serviceIds]);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWatchedRef = useRef<Partial<ProviderAccountFormData>>({});
  const watched = form.watch();

  useEffect(() => {
    const prev = prevWatchedRef.current;
    const changedKeys = (Object.keys(watched) as (keyof ProviderAccountFormData)[]).filter(
      (key) => JSON.stringify(watched[key]) !== JSON.stringify(prev[key]),
    );
    changedKeys.forEach((key) => form.clearErrors(key));
    prevWatchedRef.current = { ...watched };

    if (!form.formState.isDirty) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      const data = form.getValues();
      const parsed = providerAccountFormSchema.safeParse(data);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const path = first.path[0] as keyof ProviderAccountFormData;
        form.setError(path, { message: first.message });
        toast.error(
          "Não foi possível salvar os campos automaticamente porque há um campo inválido.",
        );
        return;
      }
      const p = parsed.data;
      const dirty = form.formState.dirtyFields;

      const profileGroupDirty = (["full_name", "phone"] as const).some((k) => dirty[k]);
      const privateGroupDirty = (
        [
          "entity_type",
          "cpf",
          "cnpj",
          "razao_social",
          "nome_fantasia",
          "legal_representative_name",
          "legal_representative_cpf",
          "commercial_contact",
        ] as const
      ).some((k) => dirty[k]);
      const publicGroupDirty = (
        ["display_name", "bio", "profile_visibility", "service_area_neighborhood_ids"] as const
      ).some((k) => dirty[k]);

      const mutations: Promise<{ error: unknown } | undefined>[] = [];
      if (profileGroupDirty) {
        mutations.push(
          updateProfileAsync({
            full_name: p.full_name.trim(),
            phone: p.phone?.trim() || null,
          }),
        );
      }
      if (privateGroupDirty) {
        mutations.push(
          updatePrivateAsync({
            entity_type: p.entity_type,
            cpf: p.cpf?.trim() || null,
            cnpj: p.cnpj?.trim() || null,
            razao_social: p.razao_social?.trim() || null,
            nome_fantasia: p.nome_fantasia?.trim() || null,
            legal_representative_name: p.legal_representative_name?.trim() || null,
            legal_representative_cpf: p.legal_representative_cpf?.trim() || null,
            commercial_contact: p.commercial_contact?.trim() || null,
          }),
        );
      }
      if (publicGroupDirty) {
        const publicPayload: Parameters<typeof updatePublicAsync>[0] = {
          display_name: p.display_name?.trim() || null,
          bio: p.bio?.trim() || null,
          profile_visibility: p.profile_visibility,
        };
        if (dirty.service_area_neighborhood_ids) {
          publicPayload.service_area_neighborhood_ids = p.service_area_neighborhood_ids?.length
            ? p.service_area_neighborhood_ids
            : null;
        }
        mutations.push(updatePublicAsync(publicPayload));
      }

      if (mutations.length === 0) return;

      Promise.all(mutations)
        .then((results) => {
          const allOk = results.every((r) => r && typeof r === "object" && !r.error);
          if (allOk) {
            form.reset(parsed.data);
            toast.success("Dados atualizados com sucesso.");
          } else {
            logger.warn("settings_provider_autosave_partial_failure", {
              errors: results.map((r) =>
                r && typeof r === "object" && "error" in r ? r.error : null,
              ),
            });
            toast.error("Não foi possível salvar todas as alterações. Tente novamente.");
          }
        })
        .catch((err: unknown) => {
          logger.error("settings_provider_autosave_error", {
            error: err instanceof Error ? err.message : String(err),
          });
          toast.error("Não foi possível atualizar seus dados. Tente novamente.");
        });
    }, 2000);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watched fields trigger debounced save
  }, [
    form,
    updateProfileAsync,
    updatePrivateAsync,
    updatePublicAsync,
    watched.full_name,
    watched.phone,
    watched.entity_type,
    watched.cpf,
    watched.cnpj,
    watched.razao_social,
    watched.nome_fantasia,
    watched.legal_representative_name,
    watched.legal_representative_cpf,
    watched.commercial_contact,
    watched.display_name,
    watched.bio,
    watched.profile_visibility,
    watched.service_area_neighborhood_ids,
  ]);

  const email = user?.email ?? "";
  const profileUrl = publicData?.slug ? buildProfileUrl(publicData.slug) : null;

  const handleCopyProfileLink = () => {
    if (!profileUrl) return;
    void navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  };

  return {
    email,
    profile,
    profileLoading,
    profileError,
    refetch,
    publicData,
    profileUrl,
    handleCopyProfileLink,
    form,
    isUpdating: isUpdatingProfile || isUpdatingPrivate || isUpdatingPublic,
    uploadPhotoAsync,
    removePhotoAsync,
    isUploading,
    isRemoving,
    offeredServiceIds,
    setOfferedServiceIds,
    setServiceIds,
    isUpdatingServices,
    portfolioItems,
    createItemWithImages,
    updateItemWithImages,
    deleteItem,
    reorderItems,
    isCreatingPortfolio,
    isUpdatingPortfolio,
    isDeletingPortfolio,
  };
}
