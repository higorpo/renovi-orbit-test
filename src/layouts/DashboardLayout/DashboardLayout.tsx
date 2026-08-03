import { Link, Outlet } from "react-router";
import { useAuth } from "@/features/auth";
import { ProviderKycGate, useProviderKycBlocksNav } from "@/features/provider-kyc";
import { ClientMyServicesPersistentSlot, ProviderMyServicesPersistentSlot } from "@/features/my-services";
import { ProviderJobsPersistentSlot } from "@/features/provider-jobs";
import { ServiceDetailSheet, useServiceDetailModal } from "@/features/view-services";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getDashboardMenu } from "./dashboardMenu";
import { DesktopNav } from "./DesktopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileStackHeader } from "./MobileStackHeader";
import { MobileStackTransition } from "./MobileStackTransition";
import { MobileTabHeader } from "./MobileTabHeader";
import { useMobileNavigationChrome } from "./useMobileNavigationChrome";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { profile } = useAuth();
  const isDesktop = useBreakpointMd();
  const isOnline = useOnlineStatus();
  const serviceDetailModal = useServiceDetailModal();
  const mobileChrome = useMobileNavigationChrome();
  const hideNavForKyc = useProviderKycBlocksNav();
  const role = profile?.role ?? "client";
  const menu = getDashboardMenu(role);
  const showBottomNav = !isDesktop && mobileChrome.showBottomNav && !hideNavForKyc;

  const outlet = mobileChrome.enableStackTransition ? (
    <MobileStackTransition>
      <Outlet />
    </MobileStackTransition>
  ) : (
    <Outlet />
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      {isDesktop && (
        <header
          className={cn(
            "sticky z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            isOnline ? "top-0" : "top-11",
          )}
        >
          <div className="container flex h-14 items-center justify-between px-4">
            <Link to="/dashboard" className="flex shrink-0 items-center">
              <img src="/logo-renovi.webp" alt="Renovi" className="h-7 w-auto md:h-8" />
            </Link>
            {hideNavForKyc ? null : (
              <DesktopNav items={menu.allItems} className="min-w-0 flex-1 justify-end" />
            )}
          </div>
        </header>
      )}

      {!isDesktop && mobileChrome.showTabHeader ? (
        <MobileTabHeader
          menu={menu}
          isOffline={!isOnline}
          hideMenu={hideNavForKyc}
        />
      ) : null}

      {!isDesktop && mobileChrome.showStackHeader ? (
        <MobileStackHeader
          title={mobileChrome.stackTitle}
          backFallback={mobileChrome.backFallback}
          isOffline={!isOnline}
        />
      ) : null}

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden",
          mobileChrome.mainOverflowHidden ? "overflow-hidden" : "overflow-y-auto",
          showBottomNav && "pb-20",
          mobileChrome.enableStackTransition && "relative overflow-hidden",
        )}
      >
        <ProviderKycGate>
          <>
            <ProviderJobsPersistentSlot />
            <ProviderMyServicesPersistentSlot />
            {outlet}
          </>
        </ProviderKycGate>
        <ClientMyServicesPersistentSlot />
        {serviceDetailModal.isOpen && serviceDetailModal.serviceRequestId ? (
          <ServiceDetailSheet serviceRequestId={serviceDetailModal.serviceRequestId} />
        ) : null}
      </main>

      {showBottomNav ? (
        <MobileBottomNav items={menu.mainItems} />
      ) : null}
    </div>
  );
}
