import { useMemo } from "react";
import type { FormStep, FormBlock, FormSchema } from "../../types";
import { InspectorSchema } from "./InspectorSchema";
import { InspectorStep } from "./InspectorStep";
import { InspectorBlock } from "./InspectorBlock";

function allBlockIds(schema: FormSchema): string[] {
  const ids: string[] = [];
  schema.steps.forEach((s: FormStep) => s.blocks.forEach((b: FormBlock) => ids.push(b.id)));
  return ids;
}

export interface InspectorProps {
  schema: FormSchema;
  selectedStep: FormStep | null;
  selectedBlock: FormBlock | null;
  selectionType: "schema" | "step" | "block" | null;
  stepId: string | null;
  blockId: string | null;
  onUpdateSchemaRoot: (updates: Partial<Pick<FormSchema, "id" | "title" | "description" | "metadata" | "config">>) => void;
  onUpdateStep: (stepId: string, updates: Partial<FormStep>) => void;
  onUpdateBlock: (stepId: string, blockId: string, updates: Partial<FormBlock>) => void;
}

export function Inspector(props: InspectorProps) {
  const {
    schema,
    selectedStep,
    selectedBlock,
    selectionType,
    stepId,
    blockId,
    onUpdateSchemaRoot,
    onUpdateStep,
    onUpdateBlock,
  } = props;

  const fieldIds = useMemo(() => allBlockIds(schema), [schema]);

  if (selectionType === "schema") {
    return (
      <InspectorSchema
        schema={schema}
        onUpdate={onUpdateSchemaRoot}
      />
    );
  }

  if (!selectionType || !stepId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm px-4">
        <p>Selecione um step ou um bloco no canvas para editar suas propriedades.</p>
      </div>
    );
  }

  if (selectionType === "step" && selectedStep) {
    return (
      <InspectorStep
        step={selectedStep}
        stepId={stepId}
        fieldIds={fieldIds}
        onUpdate={(updates) => onUpdateStep(stepId, updates)}
      />
    );
  }

  if (selectionType === "block" && selectedBlock && blockId) {
    return (
      <InspectorBlock
        block={selectedBlock}
        stepId={stepId}
        blockId={blockId}
        fieldIds={fieldIds}
        onUpdate={(updates) => onUpdateBlock(stepId, blockId, updates)}
      />
    );
  }

  return null;
}
