import { Ban } from "lucide-react";
import { KycStatusLayout } from "./KycStatusLayout";

export function KycSuspendedStatus() {
  return (
    <KycStatusLayout
      icon={Ban}
      title="Conta suspensa"
      body="Sua conta de prestador está temporariamente suspensa e o acesso às oportunidades foi bloqueado. Entre em contato com o suporte para entender o motivo e solicitar a reativação."
    />
  );
}
