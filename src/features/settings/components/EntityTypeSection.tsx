import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { HelpCircle, User, Building2 } from "lucide-react";

export type EntityType = "pf" | "pj";

export interface EntityTypeSectionProps {
  value: EntityType;
  onChange: (value: EntityType) => void;
  disabled?: boolean;
}

const PF_DESCRIPTION =
  "Para profissionais autônomos que prestam serviço em nome próprio.";
const PJ_DESCRIPTION =
  "Para empresas ou profissionais que atuam com CNPJ e dados empresariais.";

export function EntityTypeSection({
  value,
  onChange,
  disabled,
}: EntityTypeSectionProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitleWithIcon
            title="Tipo de entidade"
            icon={Building2}
            iconGradient="from-violet-500 to-purple-600"
            size="compact"
            className="!mb-0"
          />
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                aria-label="Preciso de ajuda para escolher"
              >
                <HelpCircle className="h-4 w-4 sm:mr-1" aria-hidden />
                <span className="hidden sm:inline">Preciso de ajuda para escolher</span>
              </Button>
            </DialogTrigger>
            <ShellDialogContent size="sm" className="gap-4 sm:max-w-md sm:p-6">
              <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0">
                <DialogTitle>Tipo de entidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 px-4 pb-4 text-sm text-muted-foreground sm:px-0 sm:pb-0">
                <div>
                  <p className="font-medium text-foreground">Pessoa física (PF)</p>
                  <p>{PF_DESCRIPTION}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Pessoa jurídica (PJ)</p>
                  <p>{PJ_DESCRIPTION}</p>
                </div>
                <p className="text-xs">
                  A Prestway não fornece assessoria jurídica ou contábil. Em caso de dúvida,
                  consulte um contador ou advogado.
                </p>
              </div>
            </ShellDialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="!pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => !disabled && onChange("pf")}
            disabled={disabled}
            className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
              value === "pf"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            aria-pressed={value === "pf"}
          >
            <User className="h-6 w-6" aria-hidden />
            <span className="font-medium">Pessoa física</span>
            <span className="text-sm text-muted-foreground">{PF_DESCRIPTION}</span>
          </button>
          <button
            type="button"
            onClick={() => !disabled && onChange("pj")}
            disabled={disabled}
            className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
              value === "pj"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            aria-pressed={value === "pj"}
          >
            <Building2 className="h-6 w-6" aria-hidden />
            <span className="font-medium">Pessoa jurídica</span>
            <span className="text-sm text-muted-foreground">{PJ_DESCRIPTION}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
