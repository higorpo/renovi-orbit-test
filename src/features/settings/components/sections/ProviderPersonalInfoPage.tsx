import { useForm } from "react-hook-form";
import { Phone } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SettingsCardHeader } from "../SettingsCardHeader";
import { maskPhone } from "@/lib/masks";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useProviderSettingsForm } from "../../hooks/useProviderSettingsForm";
import type { AccountFormData } from "../../types/accountForm.validation";
import type { ProviderAccountFormData } from "../../types/providerAccountForm.validation";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "../AccountSummaryCard";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { DadosPessoaisSection } from "../DadosPessoaisSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell, SettingsAutosaveHint } from "../SettingsSectionShell";

function ProviderDadosPessoaisAdapter({
  form,
  email,
}: {
  form: ReturnType<typeof useForm<ProviderAccountFormData>>;
  email: string;
}) {
  return (
    <DadosPessoaisSection
      form={form as unknown as ReturnType<typeof useForm<AccountFormData>>}
      email={email}
      showCpf={false}
    />
  );
}

export function ProviderPersonalInfoPage() {
  const isDesktop = useBreakpointMd();
  const {
    email,
    profile,
    profileLoading,
    profileError,
    refetch,
    profileUrl,
    handleCopyProfileLink,
    form,
    isUpdating,
    uploadPhotoAsync,
    removePhotoAsync,
    isUploading,
    isRemoving,
  } = useProviderSettingsForm();

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsSectionShell>
      <SettingsSectionHeader
        title="Informações pessoais"
        description="Nome, foto e telefone de contato"
      />

      {isDesktop ? (
        <div className="mb-2">
          {profileLoading ? (
            <AccountSummaryCardSkeleton />
          ) : profile ? (
            <AccountSummaryCard
              fullName={profile.full_name}
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
              sinceLabel="No ar desde"
              profileLink={profileUrl}
              onCopyProfileLink={profileUrl ? handleCopyProfileLink : undefined}
            />
          ) : null}
        </div>
      ) : null}

      {profileLoading ? (
        <ProviderFormSkeleton />
      ) : (
        <Form {...form}>
          <div className="space-y-6">
            <ProviderDadosPessoaisAdapter form={form} email={email} />
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-3 sm:pb-3">
                <SettingsCardHeader title="Contato" icon={Phone} />
              </CardHeader>
              <CardContent className="pt-0 sm:pt-0">
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
            <SettingsAutosaveHint isSaving={isUpdating} />
          </div>
        </Form>
      )}
    </SettingsSectionShell>
  );
}
