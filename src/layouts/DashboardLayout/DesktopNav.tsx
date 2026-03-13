import { NavLink, useLocation } from "react-router";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { DashboardMenuItem } from "./dashboardMenu";

interface DesktopNavProps {
  items: DashboardMenuItem[];
  className?: string;
}

export function DesktopNav({ items, className }: DesktopNavProps) {
  const location = useLocation();
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverStyle, setHoverStyle] = useState<{ left: string; width: string }>({ left: "0px", width: "0px" });
  const [activeStyle, setActiveStyle] = useState<{ left: string; width: string }>({ left: "0px", width: "0px" });

  const activeIndex = items.findIndex((item) => {
    if (item.path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(item.path);
  });
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  useEffect(() => {
    if (hoveredIndex !== null) {
      const el = tabRefs.current[hoveredIndex];
      if (el) {
        setHoverStyle({ left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px` });
      }
    }
  }, [hoveredIndex]);

  useEffect(() => {
    const el = tabRefs.current[resolvedActiveIndex];
    if (el) {
      setActiveStyle({ left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px` });
    }
  }, [resolvedActiveIndex, items.length]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = tabRefs.current[resolvedActiveIndex];
      if (el) {
        setActiveStyle({ left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px` });
      }
    });
  }, []);

  return (
    <nav className={cn("relative flex items-center", className)} aria-label="Dashboard navigation">
      <div className="relative">
        {/* Hover pill */}
        <div
          className="absolute h-[30px] rounded-md bg-muted/80 transition-all duration-300 ease-out flex items-center"
          style={{
            ...hoverStyle,
            opacity: hoveredIndex !== null ? 1 : 0,
          }}
        />
        {/* Active underline */}
        <div
          className="absolute bottom-[-14px] h-[2px] bg-primary transition-all duration-300 ease-out"
          style={activeStyle}
        />
        <div className="relative flex gap-1.5 items-center">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/dashboard"
                ? location.pathname === "/dashboard"
                : location.pathname.startsWith(item.path);
            return (
              <div
                key={item.path}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                className="flex items-center"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <NavLink
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 h-[30px] rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{item.label}</span>
                </NavLink>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
