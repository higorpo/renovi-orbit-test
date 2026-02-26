import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FormSchema, FormStep, FormBlock, FormBlockType } from "../../types";
import { BLOCK_TYPE_ICONS } from "./builderDefaults";
import { Settings } from "lucide-react";

interface SchemaCanvasProps {
  schema: FormSchema;
  schemaSelected: boolean;
  onSelectSchema: () => void;
  steps: FormStep[];
  selectedStepId: string | null;
  selectedBlockId: string | null;
  onSelectStep: (stepId: string) => void;
  onSelectBlock: (stepId: string, blockId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onRemoveBlock: (stepId: string, blockId: string) => void;
  onDropBlockType: (stepId: string, blockType: FormBlockType) => void;
  onMoveBlock: (stepId: string, fromIndex: number, toIndex: number) => void;
  activeId: string | null;
  isOverStepId: string | null;
}

function SortableBlockItem({
  block,
  stepId,
  isSelected,
  onSelect,
  onRemove,
}: {
  block: FormBlock;
  stepId: string;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { stepId, blockId: block.id, source: "step-block" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-card px-2 py-2 text-sm",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
        isDragging && "opacity-70 shadow-md"
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
        {...listeners}
        {...attributes}
        aria-label="Arrastar bloco"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="flex-1 text-left min-w-0 flex items-center gap-2"
        onClick={onSelect}
      >
        <span className="shrink-0" aria-hidden>
          {BLOCK_TYPE_ICONS[block.type as FormBlockType]}
        </span>
        <span className="truncate font-medium text-foreground">{block.label || block.id}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remover bloco"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function StepCard({
  step,
  stepIndex,
  selectedStepId,
  selectedBlockId,
  onSelectStep,
  onSelectBlock,
  onRemoveStep,
  onRemoveBlock,
  onDropBlockType: _onDropBlockType,
  onMoveBlock: _onMoveBlock,
  activeId: _activeId,
  isOver,
}: {
  step: FormStep;
  stepIndex: number;
  selectedStepId: string | null;
  selectedBlockId: string | null;
  onSelectStep: (stepId: string) => void;
  onSelectBlock: (stepId: string, blockId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onRemoveBlock: (stepId: string, blockId: string) => void;
  onDropBlockType: (stepId: string, blockType: FormBlockType) => void;
  onMoveBlock: (stepId: string, fromIndex: number, toIndex: number) => void;
  activeId: string | null;
  isOver: boolean;
}) {
  const { setNodeRef, isOver: isOverCurrent } = useDroppable({
    id: `step-${step.id}`,
    data: { stepId: step.id },
  });

  const blockIds = step.blocks.map((b) => b.id);
  const stepSelected = selectedStepId === step.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-colors",
        stepSelected ? "border-primary ring-1 ring-primary/20" : "border-border",
        isOver && "ring-2 ring-primary/30 bg-primary/5"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 cursor-pointer",
          stepSelected ? "bg-primary/10" : "hover:bg-muted/50"
        )}
      >
        <button
          type="button"
          className="flex-1 flex items-center gap-2 text-left min-w-0"
          onClick={() => onSelectStep(step.id)}
        >
          <span className="text-lg shrink-0" aria-hidden>
            {step.icon ?? "📌"}
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-foreground block truncate">
              {step.title || `Step ${stepIndex + 1}`}
            </span>
            {step.blocks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {step.blocks.length} bloco(s)
              </span>
            )}
          </div>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemoveStep(step.id)}
          aria-label="Remover step"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-2 pb-2 pt-0 space-y-1.5">
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {step.blocks.map((block: FormBlock) => (
            <SortableBlockItem
              key={block.id}
              block={block}
              stepId={step.id}
              isSelected={selectedBlockId === block.id}
              onSelect={() => onSelectBlock(step.id, block.id)}
              onRemove={() => onRemoveBlock(step.id, block.id)}
            />
          ))}
        </SortableContext>
        <div
          className={cn(
            "rounded-lg border-2 border-dashed py-4 text-center text-xs text-muted-foreground",
            isOverCurrent ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          Solte aqui para adicionar bloco
        </div>
      </div>
    </div>
  );
}

export function SchemaCanvas(props: SchemaCanvasProps) {
  const {
    schema,
    schemaSelected,
    onSelectSchema,
    steps,
    selectedStepId,
    selectedBlockId,
    onSelectStep,
    onSelectBlock,
    onRemoveStep,
    onRemoveBlock,
    onDropBlockType,
    onMoveBlock,
    activeId,
    isOverStepId,
  } = props;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onSelectSchema}
        className={cn(
          "w-full rounded-xl border bg-card overflow-hidden transition-colors text-left",
          schemaSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2.5",
            schemaSelected ? "bg-primary/10" : "hover:bg-muted/50"
          )}
        >
          <Settings className="w-5 h-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-foreground block truncate">
              Configuração do formulário
            </span>
            <span className="text-xs text-muted-foreground truncate block">
              {schema.title || schema.id || "Sem título"}
            </span>
          </div>
        </div>
      </button>

      <h3 className="text-sm font-semibold text-foreground">Steps e blocos</h3>
      <div className="space-y-3">
        {steps.map((step, stepIndex) => (
          <StepCard
            key={step.id}
            step={step}
            stepIndex={stepIndex}
            selectedStepId={selectedStepId}
            selectedBlockId={selectedBlockId}
            onSelectStep={onSelectStep}
            onSelectBlock={onSelectBlock}
            onRemoveStep={onRemoveStep}
            onRemoveBlock={onRemoveBlock}
            onDropBlockType={onDropBlockType}
            onMoveBlock={onMoveBlock}
            activeId={activeId}
            isOver={isOverStepId === step.id}
          />
        ))}
      </div>
    </div>
  );
}
