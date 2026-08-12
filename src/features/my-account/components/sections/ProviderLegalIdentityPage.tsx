import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useProviderAccountForm } from "../../hooks/useProviderAccountForm";
import { AccountRoleGate } from "../AccountRoleGate";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { EntityTypeSection } from "../EntityTypeSection";
import { LegalIdentitySection } from "../LegalIdentitySection";
import { AccountSectionHeader } from "../AccountSectionHeader";

export function ProviderLegalIdentityPage() {
  const {
    profile,
    profileLoading,
    profileError,
    refetch,
    form,
    isUpdating,
  } = useProviderAccountForm();

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <AccountRoleGate allow={["provider"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <AccountSectionHeader
          title="Identidade legal"
          description="PF/PJ e documentos cadastrais"
        />

        {profileLoading ? (
          <ProviderFormSkeleton />
        ) : (
          <Form {...form}>
            <div className="space-y-6">
              <EntityTypeSection
                value={form.watch("entity_type")}
                onChange={(v) => form.setValue("entity_type", v, { shouldDirty: true })}
              />
              <LegalIdentitySection form={form} entityType={form.watch("entity_type")} />
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
    </AccountRoleGate>
  );
}
