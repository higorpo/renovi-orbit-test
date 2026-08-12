import { useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { useUpdateAccountProfile } from "../../hooks/useUpdateAccountProfile";
import { useClientPrivateProfile } from "../../hooks/useClientPrivateProfile";
import { useUploadProfilePhoto, useRemoveProfilePhoto } from "../../hooks/useProfilePhotoMutation";
import {
  accountFormSchema,
  defaultAccountFormData,
  type AccountFormData,
} from "../../types/accountForm.validation";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "../AccountSummaryCard";
import { AccountErrorState } from "../AccountErrorState";
import { DadosPessoaisSection } from "../DadosPessoaisSection";
import { ContatoIdentidadeSection } from "../ContatoIdentidadeSection";
import { ClientFormSkeleton } from "../AccountFormSkeletons";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export function ClientPersonalInfoPage() {
  const isDesktop = useBreakpointMd();
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
    [profile, clientPrivateCpf],
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
        .then(([profileResult, cpfResult]) => {
          const profileOk = !profileResult?.error;
          const cpfOk = !cpfResult?.error;
          if (profileOk && cpfOk) {
            form.reset(parsed.data);
          } else {
            logger.warn("settings_client_autosave_partial_failure", {
              profileError: profileResult?.error ?? null,
              cpfError: cpfResult?.error ?? null,
            });
            toast.error("Não foi possível salvar todas as alterações. Tente novamente.");
          }
        })
        .catch((err: unknown) => {
          logger.error("settings_client_autosave_error", {
            error: err instanceof Error ? err.message : String(err),
          });
          toast.error("Não foi possível atualizar seus dados. Tente novamente.");
        });
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

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <SettingsSectionHeader
        title="Informações pessoais"
        description="Nome, contato e documento"
      />

      {isDesktop ? (
        <div className="mb-2">
          {profileLoading ? (
            <AccountSummaryCardSkeleton />
          ) : profile ? (
            <AccountSummaryCard
              fullName={profile.full_name}
              email={email}
              createdAt={profile.created_at}
              profileImagePath={profile.profile_image_path}
              onPhotoSelect={(file) => {
                void uploadPhotoAsync(file);
              }}
              onPhotoRemove={() => {
                if (!profile.profile_image_path) return;
                void removePhotoAsync(profile.profile_image_path);
              }}
              isUploading={isUploading}
              isRemoving={isRemoving}
            />
          ) : null}
        </div>
      ) : null}

      {profileLoading ? (
        <ClientFormSkeleton />
      ) : (
        <Form {...form}>
          <div className="space-y-6">
            <DadosPessoaisSection form={form} email={email} />
            <ContatoIdentidadeSection form={form} />
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                "As alterações são salvas automaticamente."
              )}
            </p>
          </div>
        </Form>
      )}
    </div>
  );
}
