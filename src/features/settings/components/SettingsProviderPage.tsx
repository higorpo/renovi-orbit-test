import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/features/auth";
import { useUpdateAccountProfile } from "../hooks/useUpdateAccountProfile";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { useUpdateProviderProfile } from "../hooks/useUpdateProviderProfile";
import { useUploadProfilePhoto, useRemoveProfilePhoto } from "../hooks/useProfilePhotoMutation";
import { useOfferedServices } from "../hooks/useOfferedServices";
import { usePortfolioItems } from "../hooks/usePortfolioItems";
import { PRIVACY_POLICY_URL } from "../constants";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "./AccountSummaryCard";
import { AccountErrorState } from "./AccountErrorState";
import { ProviderFormSkeleton } from "./AccountFormSkeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { Phone } from "lucide-react";
import { maskPhone } from "@/lib/masks";
import { DadosPessoaisSection } from "./DadosPessoaisSection";
import { EntityTypeSection } from "./EntityTypeSection";
import { LegalIdentitySection } from "./LegalIdentitySection";
import { OfferedServicesSection } from "./OfferedServicesSection";
import { PublicProfileSettingsSection } from "./PublicProfileSettingsSection";
import { PortfolioManagementSection } from "./PortfolioManagementSection";
import { PaymentHistorySection } from "@/features/payments";
import { PrivacySection } from "./PrivacySection";
import { DangerZoneSection } from "./DangerZoneSection";
import { LogoutSection } from "./LogoutSection";
import {
  providerAccountFormSchema,
  type ProviderAccountFormData,
} from "../types/providerAccountForm.validation";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const PAGE_TITLE = "Configurações";
const PAGE_SUBTITLE = "Gerencie seus dados, identidade profissional e perfil público";

function buildProfileUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/perfil/${slug}`;
}

/** Provider account form uses full_name + phone from profile; we need a compatible shape for DadosPessoaisSection (client form). */
function ProviderDadosPessoaisAdapter({
  form,
  email,
}: {
  form: ReturnType<typeof useForm<ProviderAccountFormData>>;
  email: string;
}) {
  return (
    <DadosPessoaisSection
      form={form as unknown as ReturnType<typeof useForm<import("../types/accountForm.validation").AccountFormData>>}
      email={email}
    />
  );
}

function SettingsProviderPage() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError, privateData, publicData, refetch } = useProviderProfile();
  const { updateProfileAsync, isUpdating: isUpdatingProfile } = useUpdateAccountProfile({ silent: true });
  const { updatePrivateAsync, updatePublicAsync, isUpdatingPrivate, isUpdatingPublic } = useUpdateProviderProfile();
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

  const defaultValues = useMemo<ProviderAccountFormData>(() => ({
    full_name: profile?.full_name?.trim() ?? "",
    phone: profile?.phone ?? "",
    entity_type: (privateData?.entity_type as "pf" | "pj") ?? "pf",
    display_name: publicData?.display_name ?? "",
    bio: publicData?.bio ?? "",
    profile_visibility: (publicData?.profile_visibility as "public" | "restricted") ?? "restricted",
    service_area_city: publicData?.service_area_city ?? "",
    service_area_neighborhood_ids: publicData?.service_area_neighborhood_ids ?? [],
    cpf: privateData?.cpf ?? "",
    cnpj: privateData?.cnpj ?? "",
    razao_social: privateData?.razao_social ?? "",
    nome_fantasia: privateData?.nome_fantasia ?? "",
    legal_representative_name: privateData?.legal_representative_name ?? "",
    legal_representative_cpf: privateData?.legal_representative_cpf ?? "",
    commercial_contact: privateData?.commercial_contact ?? "",
  }), [profile, privateData, publicData]);

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
      (key) => JSON.stringify(watched[key]) !== JSON.stringify(prev[key])
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
        toast.error("Não foi possível salvar os campos automaticamente porque há um campo inválido.");
        return;
      }
      const p = parsed.data;
      const dirty = form.formState.dirtyFields;

      const profileGroupDirty = (["full_name", "phone"] as const).some((k) => dirty[k]);
      const privateGroupDirty = (
        ["entity_type", "cpf", "cnpj", "razao_social", "nome_fantasia",
          "legal_representative_name", "legal_representative_cpf", "commercial_contact"] as const
      ).some((k) => dirty[k]);
      const publicGroupDirty = (
        ["display_name", "bio", "profile_visibility", "service_area_neighborhood_ids"] as const
      ).some((k) => dirty[k]);

      const mutations: Promise<{ error: unknown } | undefined>[] = [];
      if (profileGroupDirty) {
        mutations.push(updateProfileAsync({ full_name: p.full_name.trim(), phone: p.phone?.trim() || null }));
      }
      if (privateGroupDirty) {
        mutations.push(updatePrivateAsync({
          entity_type: p.entity_type,
          cpf: p.cpf?.trim() || null,
          cnpj: p.cnpj?.trim() || null,
          razao_social: p.razao_social?.trim() || null,
          nome_fantasia: p.nome_fantasia?.trim() || null,
          legal_representative_name: p.legal_representative_name?.trim() || null,
          legal_representative_cpf: p.legal_representative_cpf?.trim() || null,
          commercial_contact: p.commercial_contact?.trim() || null,
        }));
      }
      if (publicGroupDirty) {
        const publicPayload: Parameters<typeof updatePublicAsync>[0] = {
          display_name: p.display_name?.trim() || null,
          bio: p.bio?.trim() || null,
          profile_visibility: p.profile_visibility,
        };
        // Only sync neighborhoods when that field was explicitly changed to avoid unnecessary delete+insert
        if (dirty.service_area_neighborhood_ids) {
          publicPayload.service_area_neighborhood_ids =
            p.service_area_neighborhood_ids?.length ? p.service_area_neighborhood_ids : null;
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
                r && typeof r === "object" && "error" in r ? r.error : null
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
    // Intentionally depend on primitive field values; adding `watched` would run every render (new object ref each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form and mutation fns are stable; watched fields trigger debounced save
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
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não foi possível copiar.")
    );
  };

  const handlePhotoSelect = async (file: File) => {
    await uploadPhotoAsync(file);
  };
  const handlePhotoRemove = async () => {
    if (!profile?.profile_image_path) return;
    await removePhotoAsync(profile.profile_image_path);
  };

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  const isUpdating = isUpdatingProfile || isUpdatingPrivate || isUpdatingPublic;

  return (
    <div className="container max-w-4xl px-4 py-6">
      <header className="mb-6 sm:mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{PAGE_TITLE}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{PAGE_SUBTITLE}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <aside className="lg:col-span-1">
          {profileLoading ? (
            <AccountSummaryCardSkeleton />
          ) : profile ? (
            <AccountSummaryCard
              fullName={profile.full_name}
              email={email}
              createdAt={profile.created_at}
              profileImagePath={profile.profile_image_path}
              onPhotoSelect={handlePhotoSelect}
              onPhotoRemove={handlePhotoRemove}
              isUploading={isUploading}
              isRemoving={isRemoving}
              sinceLabel="No ar desde"
              profileLink={profileUrl}
              onCopyProfileLink={profileUrl ? handleCopyProfileLink : undefined}
            />
          ) : null}
        </aside>

        <div className="lg:col-span-2 space-y-6">
          {profileLoading ? (
            <ProviderFormSkeleton />
          ) : (
            <Form {...form}>
              <ProviderDadosPessoaisAdapter form={form} email={email} />
              <Card>
                <CardHeader className="pb-3 sm:pb-0">
                  <SectionTitleWithIcon title="Contato" icon={Phone} iconGradient="from-sky-500 to-blue-600" size="compact" className="!mb-0" />
                </CardHeader>
                <CardContent className="!pt-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone / WhatsApp</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="(00) 00000-0000"
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              <EntityTypeSection
                value={form.watch("entity_type")}
                onChange={(v) => form.setValue("entity_type", v, { shouldDirty: true })}
              />
              <LegalIdentitySection form={form} entityType={form.watch("entity_type")} />
              <OfferedServicesSection
                selectedServiceIds={offeredServiceIds}
                onSelectedChange={setOfferedServiceIds}
                setServiceIdsAsync={setServiceIds}
                isUpdating={isUpdatingServices}
              />
              <PublicProfileSettingsSection
                form={form}
                profileSlug={publicData?.slug ?? null}
              />
              <p className="text-sm text-muted-foreground flex items-center gap-2" aria-live="polite">
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    Salvando…
                  </>
                ) : (
                  "As alterações são salvas automaticamente."
                )}
              </p>
            </Form>
          )}

          <PortfolioManagementSection
            items={portfolioItems}
            onCreateItem={(params) => createItemWithImages({ ...params, visibility: "public" })}
            onUpdateItem={(itemId, params) =>
              updateItemWithImages(itemId, { ...params, visibility: "public" })
            }
            onDeleteItem={deleteItem}
            onReorderItems={reorderItems}
            isCreating={isCreatingPortfolio}
            isUpdating={isUpdatingPortfolio}
            isDeleting={isDeletingPortfolio}
          />

          <PaymentHistorySection role="provider" />

          <PrivacySection
            privacyPolicyUrl={PRIVACY_POLICY_URL}
          />

          <LogoutSection />

          <DangerZoneSection />
        </div>
      </div>
    </div>
  );
}

export { SettingsProviderPage };
