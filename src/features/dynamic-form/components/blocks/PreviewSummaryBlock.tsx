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
import { cn } from "@/lib/utils";
import {
  buildSummarySections,
  buildSummarySectionsFromConfig,
  getFormCompleteness,
} from "../../utils/summaryDisplay";

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
    ? buildSummarySectionsFromConfig(schema, formData, config)
    : buildSummarySections(schema, formData);

  const { total: totalFields, filled: filledFields, percentage: completeness } =
    getFormCompleteness(schema, formData);

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
            {section.entries.map((entry, entryIndex) => (
              <div key={entry.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.emoji && (
                        <span className="text-base">{entry.emoji}</span>
                      )}
                      <span className="text-sm font-medium text-muted-foreground">
                        {entry.label}
                      </span>
                    </div>
                    <p className="text-base font-medium break-words">
                      {entry.displayValue}
                    </p>
                  </div>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(entry.id)}
                      className="shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Editar</span>
                    </Button>
                  )}
                </div>
                {entryIndex < section.entries.length - 1 && (
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
