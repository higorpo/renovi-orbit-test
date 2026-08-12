import { Navigate } from "react-router";
import { ROUTE_SETTINGS_RECEIVABLES } from "../../constants/routes";

/** Legacy Recebimentos URL — capture history now lives on Ganhos → Cobranças. */
export function ProviderReceivablesPage() {
  return <Navigate to={ROUTE_SETTINGS_RECEIVABLES} replace />;
}
