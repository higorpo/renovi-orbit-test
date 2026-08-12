import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useProviderSettingsForm } from "../../hooks/useProviderSettingsForm";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { OfferedServicesSection } from "../OfferedServicesSection";
import { PublicProfileSettingsSection } from "../PublicProfileSettingsSection";
import { PortfolioManagementSection } from "../PortfolioManagementSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";

export function ProviderProfessionalProfilePage() {
  const {
    profile,
    profileLoading,
    profileError,
    refetch,
    publicData,
    form,
    isUpdating,
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
  } = useProviderSettingsForm();

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsRoleGate allow={["provider"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <SettingsSectionHeader
          title="Perfil profissional"
          description="Serviços, área de atuação, perfil público e portfólio"
        />

        {profileLoading ? (
          <ProviderFormSkeleton />
        ) : (
          <Form {...form}>
            <div className="space-y-6">
              <OfferedServicesSection
                selectedServiceIds={offeredServiceIds}
                onSelectedChange={setOfferedServiceIds}
                setServiceIdsAsync={setServiceIds}
                isUpdating={isUpdatingServices}
              />
              <PublicProfileSettingsSection form={form} profileSlug={publicData?.slug ?? null} />
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
      </div>
    </SettingsRoleGate>
  );
}
