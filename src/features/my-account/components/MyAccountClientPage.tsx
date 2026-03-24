import { useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/features/auth";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useUpdateAccountProfile } from "../hooks/useUpdateAccountProfile";
import { useClientPrivateProfile } from "../hooks/useClientPrivateProfile";
import { useUploadProfilePhoto, useRemoveProfilePhoto } from "../hooks/useProfilePhotoMutation";
import { AddressesSection } from "@/features/addresses";
import {
  accountFormSchema,
  defaultAccountFormData,
  type AccountFormData,
} from "../types/accountForm.validation";
import { PRIVACY_POLICY_URL } from "../constants";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "./AccountSummaryCard";
import { AccountErrorState } from "./AccountErrorState";
import { DadosPessoaisSection } from "./DadosPessoaisSection";
import { ContatoIdentidadeSection } from "./ContatoIdentidadeSection";
import { PrivacySection } from "./PrivacySection";
import { DangerZoneSection } from "./DangerZoneSection";
import { ClientFormSkeleton } from "./AccountFormSkeletons";
import { LogoutSection } from "./LogoutSection";

const PAGE_TITLE = "Minha conta";
const PAGE_SUBTITLE = "Gerencie seus dados, endereços e preferências de privacidade";

/** Delay after last change before auto-saving (ms). */
const AUTO_SAVE_DEBOUNCE_MS = 1500;

export function MyAccountClientPage() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError, refetch } = useAccountProfile();
  const { cpf: clientPrivateCpf, updateCpfAsync } = useClientPrivateProfile();
  const { updateProfileAsync, isUpdating } = useUpdateAccountProfile();
  const { uploadPhotoAsync, isUploading } = useUploadProfilePhoto();
  const { removePhotoAsync, isRemoving } = useRemoveProfilePhoto();

  const defaultValues = useMemo(
    () =>
      profile
        ? defaultAccountFormData({ ...profile, cpf: clientPrivateCpf ?? undefined })
        : undefined,
    [profile, clientPrivateCpf]
  );

  const form = useForm<AccountFormData>({
    defaultValues: defaultValues ?? {
      full_name: "",
      phone: "",
      cpf: "",
    },
  });

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    if (hydratedProfileIdRef.current === profile.id) return;
    if (!profileLoading && defaultValues) {
      form.reset(defaultValues);
      hydratedProfileIdRef.current = profile.id;
    }
  }, [profile?.id, profileLoading, defaultValues, form]);

  const email = user?.email ?? "";
  const watchedValues = form.watch();

  useEffect(() => {
    if (!form.formState.isDirty) return;

    if (autoSaveTimeoutRef.current != null) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      const data = form.getValues();
      const parsed = accountFormSchema.safeParse(data);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        form.setError(first.path[0] as keyof AccountFormData, { message: first.message });
        return;
      }
      const full_name = parsed.data.full_name.trim();
      const phone = parsed.data.phone.trim() || null;
      const cpf = parsed.data.cpf.trim() || null;
      Promise.all([
        updateProfileAsync({ full_name, phone }),
        updateCpfAsync({ cpf: cpf || null }),
      ])
        .then(([profileResult]) => {
          if (!profileResult.error) {
            form.reset(parsed.data);
          }
        })
        .catch(() => {});
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimeoutRef.current != null) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    watchedValues.full_name,
    watchedValues.phone,
    watchedValues.cpf,
    form,
    updateProfileAsync,
    updateCpfAsync,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current != null) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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

  return (
    <div className="container max-w-4xl px-4 py-6">
      <header className="mb-6 sm:mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {PAGE_TITLE}
        </h1>
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
            />
          ) : null}
        </aside>

        <div className="lg:col-span-2 space-y-6">
          {profileLoading ? (
            <ClientFormSkeleton />
          ) : (
            <Form {...form}>
              <DadosPessoaisSection form={form} email={email} />
              <ContatoIdentidadeSection form={form} />

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

          <AddressesSection />

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
