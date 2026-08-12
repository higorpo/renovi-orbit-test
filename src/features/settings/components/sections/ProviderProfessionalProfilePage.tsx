import { Form } from "@/components/ui/form";
import { useProviderSettingsForm } from "../../hooks/useProviderSettingsForm";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { AccountErrorState } from "../AccountErrorState";
import { ProviderFormSkeleton } from "../AccountFormSkeletons";
import { OfferedServicesSection } from "../OfferedServicesSection";
import { PublicProfileSettingsSection } from "../PublicProfileSettingsSection";
import { PortfolioManagementSection } from "../PortfolioManagementSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell, SettingsAutosaveHint } from "../SettingsSectionShell";

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
      <SettingsSectionShell>
        <SettingsSectionHeader
          title="Perfil profissional"
          description="Serviços, área de atuação, perfil público e portfólio"
        />

        {profileLoading ? (
          <ProviderFormSkeleton />
        ) : (
          <Form {...form}>
            <div className="space-y-5">
              <OfferedServicesSection
                selectedServiceIds={offeredServiceIds}
                onSelectedChange={setOfferedServiceIds}
                setServiceIdsAsync={setServiceIds}
                isUpdating={isUpdatingServices}
              />
              <PublicProfileSettingsSection form={form} profileSlug={publicData?.slug ?? null} />
              <SettingsAutosaveHint isSaving={isUpdating} />
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
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
