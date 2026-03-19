import { useState } from "react";
import { Link, NavLink } from "react-router";
import { Menu } from "lucide-react";
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

interface MobileNavProps {
  menu: DashboardMenuConfig;
  /** Optional title shown in the sheet header (e.g. "Área do cliente"). */
  title?: string;
  /** When true, header sticks below the offline banner. */
  isOffline?: boolean;
}

export function MobileNav({ menu, title = "Dashboard", isOffline = false }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { mainItems, allItems } = menu;

  return (
    <>
      {/* Top bar: hamburger left, logo centered, spacer right for balance */}
      <header
        className={cn(
          "sticky z-40 flex h-14 w-full items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden",
          isOffline ? "top-11" : "top-0"
        )}
      >
        <div className="flex w-10 shrink-0 items-center">
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
                            : "text-foreground hover:bg-muted"
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
        </div>
        <Link to="/dashboard" className="flex flex-1 justify-center">
          <img
            src="/logo-renovi.webp"
            alt="Renovi"
            className="h-7 w-auto"
          />
        </Link>
        <div className="w-10 shrink-0" aria-hidden="true" />
      </header>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden"
        aria-label="Navegação principal"
      >
        {mainItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/dashboard"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-0 flex-1 rounded-lg transition-colors",
                  isActive ? "text-accent" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
              <span className="text-[10px] font-medium truncate max-w-full">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
