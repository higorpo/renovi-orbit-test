import { useState } from "react";
import { NavLink } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSettingsNavLink,
  type SettingsNavItem,
  type SettingsNavLinkItem,
  type SettingsNavLogoutItem,
} from "../constants/settingsNav";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";

interface SettingsNavListProps {
  items: SettingsNavItem[];
  /** Desktop sidebar: soft primary active. Mobile list: chevron rows. */
  variant: "sidebar" | "list";
}

const NAV_ROW_CLASS =
  "group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium transition-colors duration-150";

export function SettingsNavList({ items, variant }: SettingsNavListProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const main = items.filter((item) => !item.footer);
  const footer = items.filter((item) => item.footer);

  return (
    <nav aria-label="Seções de configurações" className="flex flex-col">
      <ul className="flex flex-col gap-0.5">
        {main.map((item) => (
          <SettingsNavRow
            key={isSettingsNavLink(item) ? item.slug : item.kind}
            item={item}
            variant={variant}
            onLogout={() => setLogoutOpen(true)}
          />
        ))}
      </ul>
      {footer.length > 0 ? (
        <>
          <div className="my-3 border-t border-border" role="separator" />
          <ul className="flex flex-col gap-0.5">
            {footer.map((item) => (
              <SettingsNavRow
                key={isSettingsNavLink(item) ? item.slug : item.kind}
                item={item}
                variant={variant}
                onLogout={() => setLogoutOpen(true)}
              />
            ))}
          </ul>
        </>
      ) : null}
      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </nav>
  );
}

function SettingsNavRow({
  item,
  variant,
  onLogout,
}: {
  item: SettingsNavItem;
  variant: "sidebar" | "list";
  onLogout: () => void;
}) {
  if (item.kind === "logout") {
    return <SettingsLogoutRow item={item} variant={variant} onLogout={onLogout} />;
  }

  return <SettingsLinkRow item={item} variant={variant} />;
}

function SettingsLinkRow({
  item,
  variant,
}: {
  item: SettingsNavLinkItem;
  variant: "sidebar" | "list";
}) {
  const Icon = item.icon;

  return (
    <li>
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          cn(
            NAV_ROW_CLASS,
            variant === "list" && "justify-between py-3.5",
            isActive ? "bg-primary-soft text-ink" : "text-ink hover:bg-canvas-soft",
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

function SettingsLogoutRow({
  item,
  variant,
  onLogout,
}: {
  item: SettingsNavLogoutItem;
  variant: "sidebar" | "list";
  onLogout: () => void;
}) {
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        className={cn(
          NAV_ROW_CLASS,
          variant === "list" && "justify-between py-3.5",
          "text-ink hover:bg-canvas-soft",
        )}
        onClick={onLogout}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon
            className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-body"
            aria-hidden
            strokeWidth={1.75}
          />
          <span className="truncate">{item.label}</span>
        </span>
      </button>
    </li>
  );
}
