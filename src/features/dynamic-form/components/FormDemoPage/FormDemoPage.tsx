/**
 * Form Demo Page — full suite to build and test the dynamic form engine.
 * Builder: palette of blocks, canvas with steps (drag to add, sort blocks), inspector.
 * Preview: run the form with current schema. Copy schema button.
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Plus, Copy, Check, LayoutDashboard, Eye } from "lucide-react";
import { DynamicForm } from "../DynamicForm/DynamicForm";
import { BlockPalette } from "./BlockPalette";
import { SchemaCanvas } from "./SchemaCanvas";
import { Inspector } from "./Inspector";
import { useSchemaBuilder } from "./useSchemaBuilder";
import { BLOCK_TYPE_ICONS, BLOCK_TYPE_LABELS } from "./builderDefaults";
import { formDemoSchema } from "./demoSchema";
import type { FormBlockType, FormData, FormStep, FormBlock } from "../../types";

export interface FormDemoPageProps {
  /** Default tab (e.g. tests can start on preview without simulating Radix tab clicks). */
  initialTab?: "builder" | "preview";
}

export function FormDemoPage({ initialTab = "builder" }: FormDemoPageProps) {
  const [previewKey, setPreviewKey] = useState(0);
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverStepId, setIsOverStepId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    schema,
    selection,
    setSelection,
    selectedStep,
    selectedBlock,
    updateSchemaRoot,
    addStep,
    removeStep,
    updateStep,
    addBlockToStep,
    removeBlock,
    moveBlock,
    updateBlock,
  } = useSchemaBuilder(formDemoSchema);

  const selectedStepId =
    selection?.type === "step" ? selection.stepId : selection?.type === "block" ? selection.stepId : null;
  const selectedBlockId = selection?.type === "block" ? selection.blockId : null;
  const selectionType = selection?.type ?? null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    if (typeof overId !== "string") {
      setIsOverStepId(null);
      return;
    }
    if (String(overId).startsWith("step-")) {
      setIsOverStepId(String(overId).replace("step-", ""));
    } else {
      setIsOverStepId(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setIsOverStepId(null);

      if (!over) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);
      const activeData = active.data?.current as { source?: string; stepId?: string; blockId?: string; blockType?: FormBlockType } | undefined;

      if (activeIdStr.startsWith("palette-")) {
        const blockType = (activeData?.blockType ?? activeIdStr.replace("palette-", "")) as FormBlockType;
        if (overIdStr.startsWith("step-")) {
          const stepId = overIdStr.replace("step-", "");
          addBlockToStep(stepId, blockType);
        }
        return;
      }

      if (activeData?.source === "step-block" && activeData?.stepId) {
        const stepId = activeData.stepId;
        const step = schema.steps.find((s: FormStep) => s.id === stepId);
        if (!step) return;
        const fromIndex = step.blocks.findIndex((b: FormBlock) => b.id === activeIdStr);
        const toIndex = step.blocks.findIndex((b: FormBlock) => b.id === overIdStr);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          moveBlock(stepId, fromIndex, toIndex);
        }
      }
    },
    [schema.steps, addBlockToStep, moveBlock]
  );

  const handleCopySchema = useCallback(async () => {
    const json = JSON.stringify(schema, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [schema]);

  const handleComplete = useCallback((data: FormData) => {
    setSubmittedData(data);
  }, []);

  const handleResetPreview = useCallback(() => {
    setSubmittedData(null);
    setPreviewKey((k) => k + 1);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  if (submittedData !== null) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-row items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Formulário enviado</h2>
              <Button variant="outline" onClick={handleResetPreview}>
                Novo teste
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Dados recebidos pelo motor (JSON):
            </p>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[60vh]">
              {JSON.stringify(submittedData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground">
              Motor de formulário dinâmico — Builder
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySchema}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar schema JSON
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-[1600px] mx-auto px-4 py-6">
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
            <TabsTrigger value="builder" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Montar schema
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-0">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-3">
                  <Card>
                    <CardTitle className="text-base p-4 pb-0">Blocos</CardTitle>
                    <CardContent className="pt-4">
                      <BlockPalette />
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5">
                  <Card>
                    <div className="flex flex-row items-center justify-between p-4 pb-0">
                      <CardTitle className="text-base">Steps e blocos</CardTitle>
                      <Button type="button" size="sm" onClick={addStep} className="gap-1">
                        <Plus className="w-4 h-4" />
                        Novo step
                      </Button>
                    </div>
                    <CardContent className="pt-4 max-h-[calc(100vh-280px)] overflow-auto">
                      <SchemaCanvas
                        schema={schema}
                        schemaSelected={selectionType === "schema"}
                        onSelectSchema={() => setSelection({ type: "schema" })}
                        steps={schema.steps}
                        selectedStepId={selectedStepId}
                        selectedBlockId={selectedBlockId}
                        onSelectStep={(id) => setSelection({ type: "step", stepId: id })}
                        onSelectBlock={(stepId, blockId) =>
                          setSelection({ type: "block", stepId, blockId })
                        }
                        onRemoveStep={removeStep}
                        onRemoveBlock={removeBlock}
                        onDropBlockType={addBlockToStep}
                        onMoveBlock={moveBlock}
                        activeId={activeId}
                        isOverStepId={isOverStepId}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-4">
                  <Card>
                    <CardTitle className="text-base p-4 pb-0">Propriedades</CardTitle>
                    <CardContent className="pt-4 max-h-[calc(100vh-280px)] overflow-auto">
                      <Inspector
                        schema={schema}
                        selectedStep={selectedStep}
                        selectedBlock={selectedBlock}
                        selectionType={selectionType}
                        stepId={selectedStepId}
                        blockId={selectedBlockId}
                        onUpdateSchemaRoot={updateSchemaRoot}
                        onUpdateStep={updateStep}
                        onUpdateBlock={updateBlock}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              <DragOverlay>
                {activeId?.startsWith("palette-") ? (
                  <div className="rounded-lg border-2 border-primary bg-card px-3 py-2 shadow-lg flex items-center gap-2 text-sm">
                    <span className="text-lg">
                      {BLOCK_TYPE_ICONS[activeId.replace("palette-", "") as FormBlockType]}
                    </span>
                    <span className="font-medium">
                      {BLOCK_TYPE_LABELS[activeId.replace("palette-", "") as FormBlockType]}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <div className="max-w-xl mx-auto">
              <p className="text-sm text-muted-foreground mb-4">
                Preencha o formulário abaixo. Alterações no schema (aba Montar) refletem aqui ao
                trocar de aba.
              </p>
              <div className="min-h-[480px] rounded-xl border bg-card overflow-hidden">
                <DynamicForm
                  key={previewKey}
                  schema={schema}
                  initialData={{}}
                  onComplete={handleComplete}
                  onCancel={() => window.history.back()}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
