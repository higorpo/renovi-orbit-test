import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import type { DashboardMenuItem } from "./dashboardMenu";

interface MobileBottomNavProps {
  items: DashboardMenuItem[];
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden"
      aria-label="Navegação principal"
      data-testid="mobile-bottom-nav"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Icon className="h-6 w-6 shrink-0" aria-hidden />
            <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
