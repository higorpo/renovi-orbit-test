import { NavLink } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsNavItem } from "../constants/settingsNav";

interface SettingsNavListProps {
  items: SettingsNavItem[];
  /** Desktop sidebar: highlight active with soft background. */
  variant: "sidebar" | "list";
}

export function SettingsNavList({ items, variant }: SettingsNavListProps) {
  const main = items.filter((item) => !item.footer);
  const footer = items.filter((item) => item.footer);

  return (
    <nav aria-label="Configurações da conta" className="flex flex-col">
      <ul className="flex flex-col">
        {main.map((item) => (
          <AccountNavRow key={item.slug} item={item} variant={variant} />
        ))}
      </ul>
      {footer.length > 0 ? (
        <>
          <div className="my-2 border-t border-border" role="separator" />
          <ul className="flex flex-col">
            {footer.map((item) => (
              <AccountNavRow key={item.slug} item={item} variant={variant} />
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  );
}

function AccountNavRow({
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
            "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors duration-150",
            "hover:bg-muted/60",
            variant === "sidebar" && isActive && "bg-muted",
            variant === "list" && "justify-between",
          )
        }
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon
            className="h-5 w-5 shrink-0 text-muted-foreground"
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
      </NavLink>
    </li>
  );
}
