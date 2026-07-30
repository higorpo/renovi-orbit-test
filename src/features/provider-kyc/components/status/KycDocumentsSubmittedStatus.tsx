import { Clock } from "lucide-react";
import { KycStatusLayout } from "./KycStatusLayout";

export function KycDocumentsSubmittedStatus() {
  return (
    <KycStatusLayout
      icon={Clock}
      title="Documentos enviados"
      body="Recebemos seu credenciamento e já encaminhamos para análise do parceiro. Avisaremos quando houver novidade. Enquanto isso, você pode acessar Minha conta."
    />
  );
}
