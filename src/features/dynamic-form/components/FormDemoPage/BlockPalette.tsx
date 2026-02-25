/**
 * Block palette — list of block types to drag into steps.
 */

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { FormBlockType } from "@/features/dynamic-form/types";
import { BLOCK_TYPE_LABELS, BLOCK_TYPE_ICONS } from "./builderDefaults";

const BLOCK_TYPES: FormBlockType[] = [
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
  "conditional_alert",
  "static_text",
  "image_gallery",
  "preview_summary",
];

const PALETTE_DRAG_TYPE = "palette-block";

function DraggableBlockType({ blockType }: { blockType: FormBlockType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${blockType}`,
    data: { blockType, source: "palette" },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm cursor-grab active:cursor-grabbing",
        "hover:border-primary/50 hover:bg-muted/50",
        isDragging && "opacity-50"
      )}
    >
      <span className="text-lg" aria-hidden>
        {BLOCK_TYPE_ICONS[blockType]}
      </span>
      <span className="font-medium text-foreground">{BLOCK_TYPE_LABELS[blockType]}</span>
    </div>
  );
}

export function BlockPalette() {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground px-1">Blocos disponíveis</h3>
      <p className="text-xs text-muted-foreground px-1 mb-3">
        Arraste para um step para adicionar.
      </p>
      <div className="space-y-1.5">
        {BLOCK_TYPES.map((blockType) => (
          <DraggableBlockType key={blockType} blockType={blockType} />
        ))}
      </div>
    </div>
  );
}

export { PALETTE_DRAG_TYPE };
