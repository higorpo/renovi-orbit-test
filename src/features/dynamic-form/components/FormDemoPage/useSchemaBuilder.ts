import { useState, useCallback } from "react";
import type {
  FormSchema,
  FormStep,
  FormBlock,
  FormBlockType,
} from "../../types";
import { createBlock, createStep, createEmptySchema } from "./builderDefaults";

export type BuilderSelection =
  | { type: "schema" }
  | { type: "step"; stepId: string }
  | { type: "block"; stepId: string; blockId: string }
  | null;

export function useSchemaBuilder(initialSchema?: FormSchema | null) {
  const [schema, setSchema] = useState<FormSchema>(
    () => initialSchema ?? createEmptySchema()
  );
  const [selection, setSelection] = useState<BuilderSelection>(null);

  const selectedStep = selection?.type === "step"
    ? schema.steps.find((s: FormStep) => s.id === selection.stepId) ?? null
    : selection?.type === "block"
      ? schema.steps.find((s: FormStep) => s.id === selection.stepId) ?? null
      : null;

  const selectedBlock =
    selection?.type === "block" && selectedStep
      ? selectedStep.blocks.find((b: FormBlock) => b.id === selection.blockId) ?? null
      : null;

  const updateSchema = useCallback((updater: (prev: FormSchema) => FormSchema) => {
    setSchema(updater);
  }, []);

  const updateSchemaRoot = useCallback(
    (updates: Partial<Pick<FormSchema, "id" | "title" | "description" | "metadata" | "config">>) => {
      setSchema((prev: FormSchema) => ({
        ...prev,
        ...updates,
        ...(updates.metadata && {
          metadata: { ...prev.metadata, ...updates.metadata },
        }),
        ...(updates.config && {
          config: { ...prev.config, ...updates.config },
        }),
      }));
    },
    []
  );

  const addStep = useCallback(() => {
    const newOrder = schema.steps.length;
    const newStep = createStep({ order: newOrder, title: `Step ${newOrder + 1}`, blocks: [] });
    setSchema((prev: FormSchema) => ({
      ...prev,
      steps: [...prev.steps, newStep].sort((a, b) => a.order - b.order),
    }));
    setSelection({ type: "step", stepId: newStep.id });
  }, [schema.steps.length]);

  const removeStep = useCallback(
    (stepId: string) => {
      setSchema((prev: FormSchema) => {
        const steps = prev.steps.filter((s: FormStep) => s.id !== stepId);
        return {
          ...prev,
          steps: steps.map((s: FormStep, i: number) => ({ ...s, order: i })),
        };
      });
      if (selection?.type === "step" && selection.stepId === stepId) setSelection(null);
      if (selection?.type === "block" && selection.stepId === stepId) setSelection(null);
    },
    [selection]
  );

  const updateStep = useCallback((stepId: string, updates: Partial<FormStep>) => {
    setSchema((prev: FormSchema) => ({
      ...prev,
      steps: prev.steps.map((s: FormStep) =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const addBlockToStep = useCallback((stepId: string, blockType: FormBlockType) => {
    const newBlock = createBlock(blockType);
    setSchema((prev: FormSchema) => ({
      ...prev,
      steps: prev.steps.map((s: FormStep) =>
        s.id === stepId
          ? { ...s, blocks: [...s.blocks, newBlock] }
          : s
      ),
    }));
    setSelection({ type: "block", stepId, blockId: newBlock.id });
  }, []);

  const removeBlock = useCallback((stepId: string, blockId: string) => {
    setSchema((prev: FormSchema) => ({
      ...prev,
      steps: prev.steps.map((s: FormStep) =>
        s.id === stepId
          ? { ...s, blocks: s.blocks.filter((b: FormBlock) => b.id !== blockId) }
          : s
      ),
    }));
    if (selection?.type === "block" && selection.blockId === blockId) setSelection(null);
  }, [selection]);

  const moveBlock = useCallback(
    (stepId: string, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setSchema((prev: FormSchema) => ({
        ...prev,
        steps: prev.steps.map((s: FormStep) => {
          if (s.id !== stepId) return s;
          const blocks = [...s.blocks];
          const [removed] = blocks.splice(fromIndex, 1);
          blocks.splice(toIndex, 0, removed);
          return { ...s, blocks };
        }),
      }));
    },
    []
  );

  const updateBlock = useCallback((stepId: string, blockId: string, updates: Partial<FormBlock>) => {
    setSchema((prev: FormSchema) => ({
      ...prev,
      steps: prev.steps.map((s: FormStep) =>
        s.id === stepId
          ? {
              ...s,
              blocks: s.blocks.map((b: FormBlock) =>
                b.id === blockId ? { ...b, ...updates } : b
              ),
            }
          : s
      ),
    }));
  }, []);

  const setSchemaFromJson = useCallback((newSchema: FormSchema) => {
    setSchema(newSchema);
    setSelection(null);
  }, []);

  return {
    schema,
    setSchema,
    setSchemaFromJson,
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
    updateSchema,
  };
}
