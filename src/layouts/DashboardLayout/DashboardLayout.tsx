import { Outlet } from "react-router";
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
  const title = role === "provider" ? "Prestador" : "Área do cliente";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Desktop: top bar with Vercel-style nav */}
      {isDesktop && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between px-4">
            <span className="font-semibold text-foreground">{title}</span>
            <DesktopNav items={menu.allItems} />
          </div>
        </header>
      )}

      {/* Mobile: top bar with hamburger + bottom nav */}
      {!isDesktop && <MobileNav menu={menu} title={title} />}

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
