import { Link, Outlet } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { getDashboardMenu } from "./dashboardMenu";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { profile } = useAuth();
  const isDesktop = useBreakpointMd();
  const role = profile?.role ?? "client";
  const menu = getDashboardMenu(role);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Desktop: top bar with logo + nav */}
      {isDesktop && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <Link to="/dashboard" className="flex items-center shrink-0">
              <img
                src="/logo-renovi.webp"
                alt="Renovi"
                className="h-7 md:h-8 w-auto"
              />
            </Link>
            <DesktopNav items={menu.allItems} />
          </div>
        </header>
      )}

      {/* Mobile: top bar with hamburger + bottom nav */}
      {!isDesktop && <MobileNav menu={menu} />}

      {/* Main content: padding bottom on mobile so content is not under the bottom nav */}
      <main
        className={cn(
          "flex-1 flex flex-col",
          !isDesktop && "pb-20"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
