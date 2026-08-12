import { Outlet } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { getSettingsNavItems } from "../constants/settingsNav";
import { SettingsNavList } from "./SettingsNavList";

/**
 * Responsive account hub shell.
 * Desktop: persistent sidebar + section outlet.
 * Mobile: outlet only (index = list; sections = full pages).
 */
export function SettingsLayout() {
  const isDesktop = useBreakpointMd();
  const { profile, loading } = useAuth();
  const role = profile?.role ?? "client";
  const items = getSettingsNavItems(role);

  if (loading && !profile) {
    return (
      <div className="container px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="container px-4 py-6 md:py-8">
        <div className="flex gap-8 lg:gap-12">
          <aside className="w-64 shrink-0 lg:w-72">
            <h1 className="mb-4 font-display text-xl font-bold tracking-tight text-foreground">
              Configurações
            </h1>
            <SettingsNavList items={items} variant="sidebar" />
          </aside>
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Outlet />
    </div>
  );
}
