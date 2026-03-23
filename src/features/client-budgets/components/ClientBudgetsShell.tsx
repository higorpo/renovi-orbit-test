import { Outlet } from "react-router";
import { ClientBudgetsPage } from "./ClientBudgetsPage";

export function ClientBudgetsRouteSlot() {
  return null;
}

export function ClientBudgetsShell() {
  return (
    <>
      <ClientBudgetsPage />
      <Outlet />
    </>
  );
}
