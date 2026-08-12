import { Outlet } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { getSettingsNavItems } from "../constants/settingsNav";
import { SettingsNavList } from "./SettingsNavList";

/**
 * Responsive settings hub shell (Prestway).
 * Desktop: sticky sidebar + section outlet on canvas-soft page floor.
 * Mobile: outlet only (index = list; sections = full pages).
 *
 * Uses `grow` (not `min-h-full` / `flex-1`) so the floor fills the dashboard
 * scrollport when content is short and expands with content when tall —
 * background stays owned by this feature, not DashboardLayout.
 */
export function SettingsLayout() {
  const isDesktop = useBreakpointMd();
  const { profile, loading } = useAuth();
  const role = profile?.role ?? "client";
  const items = getSettingsNavItems(role);

  if (loading && !profile) {
    return (
      <div className="w-full grow bg-canvas-soft">
        <div className="container px-4 py-6 md:py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-lg bg-muted" />
            <div className="h-64 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="w-full grow bg-canvas-soft">
        <div className="container px-4 py-8 lg:py-10">
          <div className="flex items-start gap-10 lg:gap-14">
            {/* Stick within dashboard <main> scrollport (header is outside main). */}
            <aside className="sticky top-6 z-10 w-60 shrink-0 lg:w-64">
              <h1 className="mb-5 font-display text-display-md font-bold tracking-tight text-ink">
                Configurações
              </h1>
              <SettingsNavList items={items} variant="sidebar" />
            </aside>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl border border-border bg-canvas p-6 shadow-sm lg:p-8">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full grow bg-canvas">
      <Outlet />
    </div>
  );
}
