import { FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KycStatusLayout } from "./KycStatusLayout";

export type KycRejectedStatusProps = {
  onResubmit: () => void;
};

export function KycRejectedStatus({ onResubmit }: KycRejectedStatusProps) {
  return (
    <KycStatusLayout
      icon={FileWarning}
      title="Credenciamento não aprovado"
      body="Não foi possível aprovar seus documentos neste momento. Revise as informações e envie novamente, ou fale com o suporte se precisar de ajuda."
      action={
        <Button type="button" className="w-full" onClick={onResubmit}>
          Reenviar documentos
        </Button>
      }
    />
  );
}
