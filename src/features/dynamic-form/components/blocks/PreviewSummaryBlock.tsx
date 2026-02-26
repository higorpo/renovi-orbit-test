import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit2, CheckCircle2, AlertCircle } from "lucide-react";
import type {
  FormBlock,
  FormData,
  FormSchema,
  PreviewSummaryBlockConfig,
} from "../../types";
import { getBlockById, getVisibleBlocks, getVisibleSteps, getDisplayValue } from "../../types/helpers";
import { cn } from "@/lib/utils";

const INPUT_BLOCK_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "single_select",
  "multi_select",
  "radio",
  "checkbox",
  "yes_no",
  "date",
  "time",
  "slider",
  "property_type",
  "urgency",
  "description_ai",
  "image_gallery",
]);

interface PreviewField {
  id: string;
  label: string;
  value: unknown;
  displayValue: string;
  emoji?: string;
}

interface PreviewSection {
  id?: string;
  title: string;
  icon: string;
  fields: PreviewField[];
}

function buildSectionsFromConfig(
  schema: FormSchema,
  formData: FormData,
  config: PreviewSummaryBlockConfig
): PreviewSection[] {
  const sections: PreviewSection[] = [];
  for (const sec of config.sections ?? []) {
    const fields: PreviewField[] = [];
    for (const fieldId of sec.fieldIds) {
      const block = getBlockById(schema, fieldId);
      if (!block || !INPUT_BLOCK_TYPES.has(block.type)) continue;
      const value = formData[fieldId];
      const displayValue = getDisplayValue(block, value);
      fields.push({
        id: fieldId,
        label: block.label,
        value,
        displayValue,
        emoji: block.options?.[0]?.emoji ?? undefined,
      });
    }
    if (fields.length > 0) {
      sections.push({
        id: sec.id,
        title: sec.title,
        icon: sec.icon ?? "📋",
        fields,
      });
    }
  }
  return sections;
}

function buildSectionsFromSteps(
  schema: FormSchema,
  formData: FormData
): PreviewSection[] {
  const visibleSteps = getVisibleSteps(schema, formData);
  const sections: PreviewSection[] = [];
  for (const step of visibleSteps) {
    const visibleBlocks = getVisibleBlocks(step, formData).filter(
      (b) =>
        INPUT_BLOCK_TYPES.has(b.type) &&
        b.type !== "preview_summary"
    );
    if (visibleBlocks.length === 0) continue;
    const fields: PreviewField[] = visibleBlocks.map((block) => ({
      id: block.id,
      label: block.label,
      value: formData[block.id],
      displayValue: getDisplayValue(block, formData[block.id]),
      emoji: block.options?.[0]?.emoji ?? undefined,
    }));
    sections.push({
      id: step.id,
      title: step.title,
      icon: step.icon ?? "📋",
      fields,
    });
  }
  return sections;
}

function getTotalInputBlocks(schema: FormSchema, formData: FormData): number {
  let count = 0;
  const steps = getVisibleSteps(schema, formData);
  for (const step of steps) {
    count += getVisibleBlocks(step, formData).filter(
      (b) => INPUT_BLOCK_TYPES.has(b.type) && b.type !== "preview_summary"
    ).length;
  }
  return count;
}

function getFilledInputBlocks(schema: FormSchema, formData: FormData): number {
  let count = 0;
  const steps = getVisibleSteps(schema, formData);
  for (const step of steps) {
    for (const block of getVisibleBlocks(step, formData)) {
      if (!INPUT_BLOCK_TYPES.has(block.type) || block.type === "preview_summary") continue;
      const v = formData[block.id];
      if (v != null && v !== "" && (!Array.isArray(v) || v.length > 0)) count++;
    }
  }
  return count;
}

interface PreviewSummaryBlockProps {
  schema: FormSchema;
  block: FormBlock;
  formData: FormData;
  onEdit?: (fieldId: string) => void;
  className?: string;
}

export function PreviewSummaryBlock({
  schema,
  block,
  formData,
  onEdit,
  className,
}: PreviewSummaryBlockProps) {
  const config = block.config as PreviewSummaryBlockConfig | undefined;
  const useConfigSections =
    config?.sections != null &&
    Array.isArray(config.sections) &&
    config.sections.length > 0;

  const sections = useConfigSections
    ? buildSectionsFromConfig(schema, formData, config)
    : buildSectionsFromSteps(schema, formData);

  const totalFields = getTotalInputBlocks(schema, formData);
  const filledFields = getFilledInputBlocks(schema, formData);
  const completeness =
    totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="border-accent bg-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-accent" />
              <div>
                <h3 className="text-lg font-semibold">
                  {totalFields === 0
                    ? "Nenhum campo preenchido ainda"
                    : `Seu pedido está ${completeness}% completo`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Revise as informações antes de enviar
                </p>
              </div>
            </div>
            <Badge variant="default" className="text-base px-4 py-2">
              {filledFields} campos preenchidos
            </Badge>
          </div>
        </CardContent>
      </Card>

      {sections.map((section, sectionIndex) => (
        <Card key={section.id ?? sectionIndex}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span>{section.icon}</span>
              <span>{section.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.fields.map((field, fieldIndex) => (
              <div key={field.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {field.emoji && (
                        <span className="text-base">{field.emoji}</span>
                      )}
                      <span className="text-sm font-medium text-muted-foreground">
                        {field.label}
                      </span>
                    </div>
                    <p className="text-base font-medium break-words">
                      {field.displayValue}
                    </p>
                  </div>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(field.id)}
                      className="shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Editar</span>
                    </Button>
                  )}
                </div>
                {fieldIndex < section.fields.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {completeness < 80 && totalFields > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Pedido incompleto
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  Preencher mais informações ajuda você a receber orçamentos
                  mais precisos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
