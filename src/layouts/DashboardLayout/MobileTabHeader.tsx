import { useState } from "react";
import { Link, NavLink } from "react-router";
import { Menu } from "lucide-react";
import { PrestwayIcon } from "@/components/brand";
import type { AudienceTheme } from "@/features/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardMenuConfig } from "./dashboardMenu";

interface MobileTabHeaderProps {
  menu: DashboardMenuConfig;
  /** Optional title shown in the sheet header (e.g. "Área do cliente"). */
  title?: string;
  logoVariant?: AudienceTheme;
  /** When true, header sticks below the offline banner. */
  isOffline?: boolean;
  /** Hide hamburger + sheet (e.g. provider blocked on KYC). */
  hideMenu?: boolean;
}

export function MobileTabHeader({
  menu,
  title = "Dashboard",
  logoVariant = "client",
  isOffline = false,
  hideMenu = false,
}: MobileTabHeaderProps) {
  const [open, setOpen] = useState(false);
  const { allItems } = menu;

  return (
    <header
      className={cn(
        "sticky z-40 flex h-14 w-full items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden",
        isOffline ? "top-11" : "top-0",
      )}
      data-testid="mobile-tab-header"
    >
      <div className="flex w-10 shrink-0 items-center">
        {hideMenu ? null : (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(85vw,320px)] p-0">
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col py-2" aria-label="Menu principal">
                {allItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/dashboard"}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted",
                        )
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        )}
      </div>
      <Link to="/dashboard" className="flex flex-1 justify-center">
        <PrestwayIcon
          variant={logoVariant}
          layout="full"
          aria-label="Prestway"
          className="h-7 w-auto"
        />
      </Link>
      <div className="w-10 shrink-0" aria-hidden="true" />
    </header>
  );
}
