import { Form } from "@/components/ui/form";
import { useProviderSettingsForm } from "../../hooks/useProviderSettingsForm";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { EntityTypeSection } from "../EntityTypeSection";
import { LegalIdentitySection } from "../LegalIdentitySection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell, SettingsAutosaveHint } from "../SettingsSectionShell";

export function ProviderLegalIdentityPage() {
  const {
    profile,
    profileLoading,
    profileError,
    refetch,
    form,
    isUpdating,
  } = useProviderSettingsForm();

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsRoleGate allow={["provider"]}>
      <SettingsSectionShell>
        <SettingsSectionHeader
          title="Identidade legal"
          description="PF/PJ e documentos cadastrais"
        />

        {profileLoading ? (
          <ProviderFormSkeleton />
        ) : (
          <Form {...form}>
            <div className="space-y-5">
              <EntityTypeSection
                value={form.watch("entity_type")}
                onChange={(v) => form.setValue("entity_type", v, { shouldDirty: true })}
              />
              <LegalIdentitySection form={form} entityType={form.watch("entity_type")} />
              <SettingsAutosaveHint isSaving={isUpdating} />
            </div>
          </Form>
        )}
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
