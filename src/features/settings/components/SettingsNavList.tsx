import { NavLink } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsNavItem } from "../constants/settingsNav";

interface SettingsNavListProps {
  items: SettingsNavItem[];
  /** Desktop sidebar: soft primary active. Mobile list: chevron rows. */
  variant: "sidebar" | "list";
}

export function SettingsNavList({ items, variant }: SettingsNavListProps) {
  const main = items.filter((item) => !item.footer);
  const footer = items.filter((item) => item.footer);

  return (
    <nav aria-label="Seções de configurações" className="flex flex-col">
      <ul className={cn("flex flex-col", variant === "list" ? "gap-0.5" : "gap-0.5")}>
        {main.map((item) => (
          <SettingsNavRow key={item.slug} item={item} variant={variant} />
        ))}
      </ul>
      {footer.length > 0 ? (
        <>
          <div className="my-3 border-t border-border" role="separator" />
          <ul className="flex flex-col gap-0.5">
            {footer.map((item) => (
              <SettingsNavRow key={item.slug} item={item} variant={variant} />
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  );
}

function SettingsNavRow({
  item,
  variant,
}: {
  item: SettingsNavItem;
  variant: "sidebar" | "list";
}) {
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          cn(
            "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150",
            variant === "list" && "justify-between py-3.5",
            isActive
              ? "bg-primary-soft text-ink"
              : "text-ink hover:bg-canvas-soft",
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className="flex min-w-0 items-center gap-3">
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-body",
                )}
                aria-hidden
                strokeWidth={1.75}
              />
              <span className="truncate">{item.label}</span>
            </span>
            {variant === "list" ? (
              <ChevronRight
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
                strokeWidth={1.75}
              />
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  );
}
