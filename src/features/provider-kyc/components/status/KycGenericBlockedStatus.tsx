import { ShieldAlert } from "lucide-react";
import { KycStatusLayout } from "./KycStatusLayout";

export function KycGenericBlockedStatus() {
  return (
    <KycStatusLayout
      icon={ShieldAlert}
      title="Credenciamento necessário"
      body="Para usar a plataforma como prestador, seu credenciamento precisa estar ativo. Se acredita que isso é um erro, fale com o suporte."
    />
  );
}
