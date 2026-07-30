import { Loader2, Send } from "lucide-react";
import { KycStatusLayout } from "./KycStatusLayout";

export function KycSubmittingStatus() {
  return (
    <KycStatusLayout
      icon={Send}
      title="Enviando credenciamento…"
      body="Estamos finalizando o envio dos seus documentos. Isso pode levar alguns instantes — você pode deixar esta tela aberta."
      showSupportCta={false}
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
    </KycStatusLayout>
  );
}
