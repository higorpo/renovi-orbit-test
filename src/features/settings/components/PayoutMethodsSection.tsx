import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCardHeader } from "./SettingsCardHeader";

export type PayoutMethodsSectionProps = {
  bankLabel: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  pixKey: string | null;
  supportHref: string;
};

function ReadOnlyField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly
        disabled
        aria-readonly="true"
        className="bg-canvas-soft"
      />
    </div>
  );
}

export function PayoutMethodsSection({
  bankLabel,
  bankBranch,
  bankAccount,
  pixKey,
  supportHref,
}: PayoutMethodsSectionProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Conta para depósito"
          icon={Landmark}
          description="Informados no cadastro. Alterações só pelo suporte."
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        <ReadOnlyField id="payout-bank" label="Banco" value={bankLabel ?? "—"} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField id="payout-branch" label="Agência" value={bankBranch ?? "—"} />
          <ReadOnlyField
            id="payout-account"
            label="Conta com dígito"
            value={bankAccount ?? "—"}
          />
        </div>
        <ReadOnlyField
          id="payout-pix"
          label="Chave PIX"
          value={pixKey ?? "Não informada"}
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Estes dados não podem ser alterados por aqui. Se precisar atualizar banco, agência, conta
          ou PIX, fale com o suporte.
        </p>
        <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
          <a href={supportHref} target="_blank" rel="noopener noreferrer">
            Falar com o suporte
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
