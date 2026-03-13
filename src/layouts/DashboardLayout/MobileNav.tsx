import { useState } from "react";
import { NavLink } from "react-router";
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
  /** Optional title shown in the top bar (e.g. current page or app name). */
  title?: string;
}

export function MobileNav({ menu, title = "Dashboard" }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { mainItems, allItems } = menu;

  return (
    <>
      {/* Top bar with hamburger and title */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
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
        <span className="font-semibold text-foreground">{title}</span>
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
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-0 flex-1 rounded-lg transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
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
