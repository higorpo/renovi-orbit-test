import { useState } from "react";
import { Briefcase, Eye } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useProviderSettingsForm } from "../../hooks/useProviderSettingsForm";
import { SettingsRoleGate } from "../SettingsRoleGate";
import { AccountErrorState } from "../AccountErrorState";
import { ProfessionalProfileFormSkeleton } from "../AccountFormSkeletons";
import { OfferedServicesSection } from "../OfferedServicesSection";
import { PublicProfileSettingsSection } from "../PublicProfileSettingsSection";
import { ServiceAreaSection } from "../ServiceAreaField";
import { PortfolioManagementSection } from "../PortfolioManagementSection";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { SettingsSectionShell, SettingsAutosaveHint } from "../SettingsSectionShell";

type ProfessionalProfileTab = "orders" | "showcase";

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
  const [tab, setTab] = useState<ProfessionalProfileTab>("orders");

  if (profileError && !profile) {
    return <AccountErrorState onRetry={refetch} />;
  }

  return (
    <SettingsRoleGate allow={["provider"]}>
      <SettingsSectionShell>
        <SettingsSectionHeader
          title="Perfil profissional"
          description="Pedidos que você recebe e como os clientes te veem"
        />

        {profileLoading ? (
          <ProfessionalProfileFormSkeleton />
        ) : (
          <Form {...form}>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as ProfessionalProfileTab)}
              className="w-full"
            >
              <TabsList
                className={cn(
                  "grid w-full grid-cols-2 gap-1 rounded-xl bg-canvas-soft p-1",
                  "min-h-0 overflow-visible",
                )}
                aria-label="Seções do perfil profissional"
              >
                <TabsTrigger
                  value="orders"
                  className={cn(
                    "h-10 gap-2 rounded-lg px-3 text-sm font-medium",
                    "data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-sm",
                  )}
                >
                  <Briefcase className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">Pedidos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="showcase"
                  className={cn(
                    "h-10 gap-2 rounded-lg px-3 text-sm font-medium",
                    "data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-sm",
                  )}
                >
                  <Eye className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">Vitrine</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="mt-5 focus-visible:ring-0">
                <div className="space-y-5">
                  <OfferedServicesSection
                    selectedServiceIds={offeredServiceIds}
                    onSelectedChange={setOfferedServiceIds}
                    setServiceIdsAsync={setServiceIds}
                    isUpdating={isUpdatingServices}
                  />
                  <ServiceAreaSection form={form} />
                  <SettingsAutosaveHint isSaving={isUpdating} />
                </div>
              </TabsContent>

              <TabsContent value="showcase" className="mt-5 focus-visible:ring-0">
                <div className="space-y-5">
                  <PublicProfileSettingsSection
                    form={form}
                    profileSlug={publicData?.slug ?? null}
                  />
                  <SettingsAutosaveHint isSaving={isUpdating} />
                  <PortfolioManagementSection
                    items={portfolioItems}
                    onCreateItem={(params) =>
                      createItemWithImages({ ...params, visibility: "public" })
                    }
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
              </TabsContent>
            </Tabs>
          </Form>
        )}
      </SettingsSectionShell>
    </SettingsRoleGate>
  );
}
