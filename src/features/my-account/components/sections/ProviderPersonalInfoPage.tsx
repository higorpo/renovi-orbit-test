import { useForm } from "react-hook-form";
import { Loader2, Phone } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { maskPhone } from "@/lib/masks";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useProviderAccountForm } from "../../hooks/useProviderAccountForm";
import type { AccountFormData } from "../../types/accountForm.validation";
import type { ProviderAccountFormData } from "../../types/providerAccountForm.validation";
import { AccountSummaryCard, AccountSummaryCardSkeleton } from "../AccountSummaryCard";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { DadosPessoaisSection } from "../DadosPessoaisSection";
import { AccountSectionHeader } from "../AccountSectionHeader";

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
  } = useProviderAccountForm();

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
      <AccountSectionHeader
        title="Informações pessoais"
        description="Nome, foto e telefone de contato"
      />

      {isDesktop ? (
        <div className="mb-2 max-w-sm">
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
            <Card>
              <CardHeader className="pb-3 sm:pb-0">
                <SectionTitleWithIcon
                  title="Contato"
                  icon={Phone}
                  iconGradient="from-sky-500 to-blue-600"
                  size="compact"
                  className="!mb-0"
                />
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
