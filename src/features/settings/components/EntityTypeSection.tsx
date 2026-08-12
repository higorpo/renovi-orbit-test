import { useState } from "react";
import { Check, User, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function entityTypeChangeCopy(next: EntityType): { title: string; description: string } {
  if (next === "pj") {
    return {
      title: "Trocar para pessoa jurídica?",
      description:
        "Os documentos do cadastro passam a ser os da empresa (CNPJ, razão social e representante legal).",
    };
  }
  return {
    title: "Trocar para pessoa física?",
    description:
      "Os documentos do cadastro passam a ser os de pessoa física (CPF). Os dados da empresa deixam de ser o documento principal.",
  };
}

interface EntityTypeOptionProps {
  selected: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onSelect: () => void;
}

function EntityTypeOption({
  selected,
  disabled,
  icon: Icon,
  title,
  description,
  onSelect,
}: EntityTypeOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "relative flex min-h-11 flex-col items-start gap-3 rounded-2xl border p-4 text-left",
        "transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-ink bg-canvas shadow-sm"
          : "border-border bg-canvas hover:border-ink/20 hover:bg-canvas-soft",
      )}
    >
      <span
        className={cn(
          "absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full",
          "transition-colors duration-150",
          selected ? "bg-ink text-white" : "border border-border bg-canvas",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={2.75} /> : null}
      </span>

      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150",
          selected ? "bg-ink text-white" : "bg-primary-soft text-ink",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>

      <span className="space-y-1 pr-6">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          {title}
        </span>
        <span className="block text-sm leading-relaxed text-body">{description}</span>
      </span>
    </button>
  );
}

export function EntityTypeSection({
  value,
  onChange,
  disabled,
}: EntityTypeSectionProps) {
  const [pendingType, setPendingType] = useState<EntityType | null>(null);
  const copy = pendingType ? entityTypeChangeCopy(pendingType) : null;

  const requestChange = (next: EntityType) => {
    if (disabled || next === value) return;
    setPendingType(next);
  };

  const confirmChange = () => {
    const next = pendingType;
    setPendingType(null);
    if (next) onChange(next);
  };

  return (
    <section className="space-y-3" aria-labelledby="entity-type-heading">
      <div className="space-y-1">
        <h3
          id="entity-type-heading"
          className="font-display text-[15px] font-semibold tracking-tight text-ink"
        >
          Tipo de entidade
        </h3>
        <p className="text-sm leading-relaxed text-body">
          Define os documentos do cadastro e como você aparece nos contratos.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="entity-type-heading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <EntityTypeOption
          selected={value === "pf"}
          disabled={disabled}
          icon={User}
          title="Pessoa física"
          description={PF_DESCRIPTION}
          onSelect={() => requestChange("pf")}
        />
        <EntityTypeOption
          selected={value === "pj"}
          disabled={disabled}
          icon={Building2}
          title="Pessoa jurídica"
          description={PJ_DESCRIPTION}
          onSelect={() => requestChange("pj")}
        />
      </div>

      <p className="text-caption text-muted-foreground">
        A Prestway não fornece assessoria jurídica ou contábil. Em caso de dúvida, consulte
        um contador ou advogado.
      </p>

      <AlertDialog
        open={pendingType != null}
        onOpenChange={(open) => {
          if (!open) setPendingType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange}>Trocar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
