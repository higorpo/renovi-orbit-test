/**
 * Hook for form schema builder state: schema, selection, and mutations.
 */

import { useState, useCallback } from "react";
import type {
  FormSchemaV2,
  FormStepV2,
  FormBlockV2,
  FormBlockType,
  FormSchemaMetadata,
  FormSchemaConfig,
} from "../../types";
import { createBlock, createStep, createEmptySchema } from "./builderDefaults";

export type BuilderSelection =
  | { type: "schema" }
  | { type: "step"; stepId: string }
  | { type: "block"; stepId: string; blockId: string }
  | null;

export function useSchemaBuilder(initialSchema?: FormSchemaV2 | null) {
  const [schema, setSchema] = useState<FormSchemaV2>(
    () => initialSchema ?? createEmptySchema()
  );
  const [selection, setSelection] = useState<BuilderSelection>(null);

  const selectedStep = selection?.type === "step"
    ? schema.steps.find((s) => s.id === selection.stepId) ?? null
    : selection?.type === "block"
      ? schema.steps.find((s) => s.id === selection.stepId) ?? null
      : null;

  const selectedBlock =
    selection?.type === "block" && selectedStep
      ? selectedStep.blocks.find((b) => b.id === selection.blockId) ?? null
      : null;

  const updateSchema = useCallback((updater: (prev: FormSchemaV2) => FormSchemaV2) => {
    setSchema(updater);
  }, []);

  const updateSchemaRoot = useCallback(
    (updates: Partial<Pick<FormSchemaV2, "id" | "title" | "description" | "metadata" | "config">>) => {
      setSchema((prev) => ({
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
    setSchema((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep].sort((a, b) => a.order - b.order),
    }));
    setSelection({ type: "step", stepId: newStep.id });
  }, [schema.steps.length]);

  const removeStep = useCallback(
    (stepId: string) => {
      setSchema((prev) => {
        const steps = prev.steps.filter((s) => s.id !== stepId);
        steps.forEach((s, i) => ({ ...s, order: i }));
        return {
          ...prev,
          steps: steps.map((s, i) => ({ ...s, order: i })),
        };
      });
      if (selection?.type === "step" && selection.stepId === stepId) setSelection(null);
      if (selection?.type === "block" && selection.stepId === stepId) setSelection(null);
    },
    [selection]
  );

  const updateStep = useCallback((stepId: string, updates: Partial<FormStepV2>) => {
    setSchema((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const addBlockToStep = useCallback((stepId: string, blockType: FormBlockType) => {
    const newBlock = createBlock(blockType);
    setSchema((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId
          ? { ...s, blocks: [...s.blocks, newBlock] }
          : s
      ),
    }));
    setSelection({ type: "block", stepId, blockId: newBlock.id });
  }, []);

  const removeBlock = useCallback((stepId: string, blockId: string) => {
    setSchema((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId
          ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }
          : s
      ),
    }));
    if (selection?.type === "block" && selection.blockId === blockId) setSelection(null);
  }, [selection]);

  const moveBlock = useCallback(
    (stepId: string, fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setSchema((prev) => ({
        ...prev,
        steps: prev.steps.map((s) => {
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

  const updateBlock = useCallback((stepId: string, blockId: string, updates: Partial<FormBlockV2>) => {
    setSchema((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              blocks: s.blocks.map((b) =>
                b.id === blockId ? { ...b, ...updates } : b
              ),
            }
          : s
      ),
    }));
  }, []);

  const setSchemaFromJson = useCallback((newSchema: FormSchemaV2) => {
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
