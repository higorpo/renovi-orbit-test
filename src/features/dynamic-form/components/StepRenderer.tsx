import { useFormContext } from "./FormContext";
import type { FormBlock } from "../types";
import { getRelatedAlerts } from "../types/helpers";
import { cn } from "@/lib/utils";
import { blockRegistry, renderBlockByType, type BlockRenderProps } from "./blocks/registry";
import { ConditionalAlertBlock } from "./blocks/ConditionalAlertBlock";

interface StepRendererProps {
  className?: string;
  onAutoAdvance?: () => void;
}

function UnsupportedBlock({ block }: { block: FormBlock }) {
  return (
    <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
      <p className="text-destructive text-sm font-medium">
        Tipo de bloco não suportado: &quot;{block.type}&quot;
      </p>
      <p className="text-destructive/70 text-xs mt-1">ID: {block.id}</p>
    </div>
  );
}

export function StepRenderer({
  className,
  onAutoAdvance,
}: StepRendererProps) {
  const {
    formData,
    setFieldValue,
    schema,
    currentStepData,
    getVisibleBlocks,
    visibleSteps,
    goToStep,
  } = useFormContext();

  if (!currentStepData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando formulário...
      </div>
    );
  }

  const visibleBlocks = getVisibleBlocks(currentStepData).filter(
    (b) => b.type !== "conditional_alert"
  );

  const handleFieldChange = (blockId: string, value: unknown) => {
    setFieldValue(blockId, value);
    const block = visibleBlocks.find((b) => b.id === blockId);
    const autoAdvance = block?.config?.autoAdvance as boolean | undefined;
    if (autoAdvance && value != null && value !== "" && onAutoAdvance) {
      setTimeout(() => onAutoAdvance(), 300);
    }
  };

  const onEditFromSummary = (fieldId: string) => {
    const stepIndex = visibleSteps.findIndex((step) =>
      getVisibleBlocks(step).some((b) => b.id === fieldId)
    );
    if (stepIndex !== -1) goToStep(stepIndex);
  };

  const { title: stepTitle, description: stepDescription, icon: stepIcon } = currentStepData;

  const blockRenderProps: Omit<BlockRenderProps, "block"> = {
    schema,
    formData,
    setFieldValue,
    handleFieldChange,
    onEditFromSummary,
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        {stepIcon && (
          <span className="text-3xl block" aria-hidden>
            {stepIcon}
          </span>
        )}
        <h2 className="text-xl font-semibold text-foreground">{stepTitle}</h2>
        {stepDescription && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {stepDescription}
          </p>
        )}
      </div>
      <div className="space-y-6 py-2">
        {visibleBlocks.map((block) => {
          const relatedAlerts = getRelatedAlerts(block.id, currentStepData, formData);
          const renderedBlock = blockRegistry[block.type]
            ? renderBlockByType({ ...blockRenderProps, block })
            : <UnsupportedBlock block={block} />;
          return (
            <div key={block.id} className="space-y-2">
              {renderedBlock}
              {relatedAlerts.length > 0 && (
                <div className="space-y-2">
                  {relatedAlerts.map((alert) => (
                    <ConditionalAlertBlock key={alert.id} block={alert} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
