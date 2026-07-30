import { Search } from "lucide-react";
import { KycStatusLayout } from "./KycStatusLayout";

export function KycUnderReviewStatus() {
  return (
    <KycStatusLayout
      icon={Search}
      title="Credenciamento em análise"
      body="Seus documentos estão em análise. Esse processo pode levar alguns dias úteis. Assim que for aprovado, você terá acesso completo à plataforma."
    />
  );
}
