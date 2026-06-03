import { NavLink, useLocation } from "react-router";
import { useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  NAV_ITEM_GAP_PX,
  computeDesktopNavVisibleCount,
} from "./computeDesktopNavVisibleCount";
import type { DashboardMenuItem } from "./dashboardMenu";

interface DesktopNavProps {
  items: DashboardMenuItem[];
  className?: string;
  /** Use light text and accents (e.g. when nav is inside a dark header). */
  inverted?: boolean;
}

function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(itemPath);
}

const navLinkClassName = (
  inverted: boolean | undefined,
  isActive: boolean
) =>
  cn(
    "relative z-10 flex items-center gap-2 px-3 py-2 h-[30px] rounded-md text-sm font-medium transition-colors cursor-pointer",
    inverted
      ? isActive
        ? "text-white"
        : "text-white/70 group-hover:text-white"
      : isActive
        ? "text-foreground"
        : "text-muted-foreground group-hover:text-foreground"
  );

const tabHoverBgClassName = (inverted: boolean | undefined) =>
  cn(
    "pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100",
    inverted ? "bg-white/20" : "bg-muted/80"
  );

/** Overrides global a/button focus-visible rings in index.css for compact nav controls. */
const suppressFocusRingClass =
  "outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const moreTriggerClassName = (inverted: boolean | undefined, isActive: boolean) =>
  cn(
    "relative z-10 inline-flex h-[30px] w-full shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 px-2 text-sm font-medium transition-colors cursor-pointer",
    suppressFocusRingClass,
    inverted
      ? isActive
        ? "text-white"
        : "text-white/70 group-hover:text-white"
      : isActive
        ? "text-foreground"
        : "text-muted-foreground group-hover:text-foreground"
  );

/** Gap below the tab control; matches previous `bottom-[-14px]` on a 30px-tall track. */
const ACTIVE_INDICATOR_OFFSET_BELOW_TAB_PX = 12;

function getTabIndicatorStyle(
  tabEl: HTMLElement | null,
  trackEl: HTMLElement | null
): { left: string; width: string; top: string } {
  if (!tabEl || !trackEl) return { left: "0px", width: "0px", top: "0px" };
  const trackRect = trackEl.getBoundingClientRect();
  const tabRect = tabEl.getBoundingClientRect();
  // Anchor to track height (not tab bottom) so native <button> boxes cannot push the line down.
  return {
    left: `${tabRect.left - trackRect.left}px`,
    width: `${tabRect.width}px`,
    top: `${trackEl.offsetHeight + ACTIVE_INDICATOR_OFFSET_BELOW_TAB_PX}px`,
  };
}

export function DesktopNav({ items, className, inverted }: DesktopNavProps) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const tabsTrackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const measureItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLDivElement>(null);
  const [activeStyle, setActiveStyle] = useState<{
    left: string;
    width: string;
    top: string;
  }>({
    left: "0px",
    width: "0px",
    top: "0px",
  });
  const [visibleCount, setVisibleCount] = useState(items.length);

  const activeIndex = items.findIndex((item) =>
    isNavItemActive(location.pathname, item.path)
  );
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;
  const isActiveInOverflow = overflowItems.some((item) =>
    isNavItemActive(location.pathname, item.path)
  );

  const setTabRef = useCallback((index: number, el: HTMLElement | null) => {
    tabRefs.current[index] = el;
  }, []);

  const recalculateVisibleCount = useCallback(() => {
    const nav = navRef.current;
    if (!nav || items.length === 0) {
      setVisibleCount(items.length);
      return;
    }

    const availableWidth = nav.clientWidth;
    if (availableWidth <= 0) return;

    const itemWidths = items.map(
      (_, index) => measureItemRefs.current[index]?.offsetWidth ?? 0
    );
    const moreWidth = moreMeasureRef.current?.offsetWidth ?? 0;

    const nextCount = computeDesktopNavVisibleCount({
      containerWidth: availableWidth,
      itemWidths,
      moreButtonWidth: moreWidth,
      gapPx: NAV_ITEM_GAP_PX,
    });

    setVisibleCount((prev) => (prev === nextCount ? prev : nextCount));
  }, [items]);

  useLayoutEffect(() => {
    recalculateVisibleCount();
  }, [recalculateVisibleCount, items, visibleCount]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const observer = new ResizeObserver(() => recalculateVisibleCount());
    observer.observe(nav);

    const headerRow = nav.parentElement;
    if (headerRow) observer.observe(headerRow);

    window.addEventListener("resize", recalculateVisibleCount);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalculateVisibleCount);
    };
  }, [recalculateVisibleCount]);

  const activeTabIndex = hasOverflow && isActiveInOverflow
    ? visibleCount
    : resolvedActiveIndex < visibleCount
      ? resolvedActiveIndex
      : visibleCount > 0
        ? visibleCount - 1
        : 0;

  const syncActiveIndicator = useCallback(() => {
    const track = tabsTrackRef.current;
    setActiveStyle(getTabIndicatorStyle(tabRefs.current[activeTabIndex] ?? null, track));
  }, [activeTabIndex]);

  useLayoutEffect(() => {
    tabRefs.current.length = visibleCount + (hasOverflow ? 1 : 0);
    syncActiveIndicator();
  }, [syncActiveIndicator, visibleCount, hasOverflow, items.length, location.pathname]);

  useEffect(() => {
    const track = tabsTrackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(() => syncActiveIndicator());
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncActiveIndicator]);

  const renderNavLink = (item: DashboardMenuItem, index: number) => {
    const Icon = item.icon;
    const isActive = isNavItemActive(location.pathname, item.path);
    return (
      <div key={item.path} className="group relative flex items-center">
        <div className={tabHoverBgClassName(inverted)} aria-hidden />
        <NavLink
          ref={(el) => setTabRef(index, el)}
          to={item.path}
          className={navLinkClassName(inverted, isActive)}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">{item.label}</span>
        </NavLink>
      </div>
    );
  };

  return (
    <nav
      ref={navRef}
      className={cn("relative flex min-w-0 w-full items-center", className)}
      aria-label="Dashboard navigation"
    >
      {/* Off-screen row for width measurement (must not affect nav layout) */}
      <div
        className="pointer-events-none fixed -left-[9999px] top-0 flex gap-1.5 opacity-0"
        aria-hidden
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={`measure-${item.path}`}
              ref={(el) => {
                measureItemRefs.current[index] = el;
              }}
              className="flex items-center"
            >
              <span className={navLinkClassName(inverted, false)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
              </span>
            </div>
          );
        })}
        <div ref={moreMeasureRef} className="flex items-center">
          <span className={cn(navLinkClassName(inverted, false), "px-2")}>
            <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
          </span>
        </div>
      </div>

      <div
        ref={tabsTrackRef}
        className="relative inline-flex h-[30px] min-w-0 max-w-full items-center gap-1.5 overflow-visible"
      >
        <div
          className={cn(
            "pointer-events-none absolute z-0 h-[2px] transition-[left,width,top] duration-300 ease-out",
            inverted ? "bg-white" : "bg-primary"
          )}
          style={activeStyle}
        />

        {visibleItems.map((item, index) => renderNavLink(item, index))}

        {hasOverflow ? (
          <div
            ref={(el) => setTabRef(visibleCount, el)}
            className="group relative flex h-[30px] items-center"
          >
            <div className={tabHoverBgClassName(inverted)} aria-hidden />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Mais opções de navegação"
                  className={moreTriggerClassName(inverted, isActiveInOverflow)}
                >
                  <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[12rem]"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(location.pathname, item.path);
                return (
                  <DropdownMenuItem key={item.path} asChild>
                    <NavLink
                      to={item.path}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                        suppressFocusRingClass,
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground focus:bg-accent focus:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{item.label}</span>
                    </NavLink>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
