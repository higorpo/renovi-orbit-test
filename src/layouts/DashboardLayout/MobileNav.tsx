import { MobileTabHeader } from "./MobileTabHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import type { DashboardMenuConfig } from "./dashboardMenu";

interface MobileNavProps {
  menu: DashboardMenuConfig;
  /** Optional title shown in the sheet header (e.g. "Área do cliente"). */
  title?: string;
  /** When true, header sticks below the offline banner. */
  isOffline?: boolean;
}

/** Tab-root mobile chrome: logo header + bottom navigation. */
export function MobileNav({ menu, title = "Dashboard", isOffline = false }: MobileNavProps) {
  return (
    <>
      <MobileTabHeader menu={menu} title={title} isOffline={isOffline} />
      <MobileBottomNav items={menu.mainItems} />
    </>
  );
}

export { MobileTabHeader } from "./MobileTabHeader";
export { MobileBottomNav } from "./MobileBottomNav";
export { MobileStackHeader } from "./MobileStackHeader";
export { MobileStackTransition } from "./MobileStackTransition";
