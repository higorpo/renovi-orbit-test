import type { FormStep } from "../../types";
import type { SchemaValidationError, StepValidationResult } from "./types";

export function validateGlobalBlocks(steps: FormStep[]): StepValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const allBlockTypes = new Set<string>();
  for (const step of steps) {
    for (const block of step.blocks) allBlockTypes.add(block.type);
  }
  if (!allBlockTypes.has("property_type")) {
    errors.push({
      code: "MISSING_PROPERTY_TYPE",
      message: 'Schema must have a block of type "property_type"',
      severity: "error",
    });
  }
  if (!allBlockTypes.has("urgency")) {
    errors.push({
      code: "MISSING_URGENCY",
      message: 'Schema must have a block of type "urgency"',
      severity: "error",
    });
  }
  if (!allBlockTypes.has("description_ai") && !allBlockTypes.has("textarea")) {
    warnings.push({
      code: "MISSING_DESCRIPTION",
      message: 'Schema should have a "description_ai" or "textarea" block for description',
      severity: "warning",
    });
  }
  return { errors, warnings };
}

export function validateGlobalOrder(steps: FormStep[]): StepValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const firstStep = sortedSteps[0];
  if (firstStep && !firstStep.blocks.some((b) => b.type === "property_type")) {
    errors.push({
      code: "PROPERTY_TYPE_NOT_FIRST",
      message: 'First step must contain the "property_type" block',
      severity: "error",
    });
  }
  let propertyTypeOrder = -1;
  let urgencyOrder = -1;
  let descriptionOrder = -1;
  for (const step of sortedSteps) {
    for (const block of step.blocks) {
      if (block.type === "property_type") propertyTypeOrder = step.order;
      if (block.type === "urgency") urgencyOrder = step.order;
      if (block.type === "description_ai") descriptionOrder = step.order;
    }
  }
  if (
    propertyTypeOrder > -1 &&
    urgencyOrder > -1 &&
    urgencyOrder < propertyTypeOrder
  ) {
    errors.push({
      code: "URGENCY_BEFORE_PROPERTY",
      message: "Urgency block must come after property_type",
      severity: "error",
    });
  }
  if (
    descriptionOrder > -1 &&
    urgencyOrder > -1 &&
    descriptionOrder < urgencyOrder
  ) {
    warnings.push({
      code: "DESCRIPTION_ORDER",
      message: "Description block should generally come after urgency",
      severity: "warning",
    });
  }
  return { errors, warnings };
}
