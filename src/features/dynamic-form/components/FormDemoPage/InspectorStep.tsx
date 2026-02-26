import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { FormStep } from "../../types";
import { VisibilityRulesEditor } from "./VisibilityRulesEditor";

interface InspectorStepProps {
  step: FormStep;
  stepId: string;
  fieldIds: string[];
  onUpdate: (updates: Partial<FormStep>) => void;
}

export function InspectorStep({ step, stepId: _stepId, fieldIds, onUpdate }: InspectorStepProps) {
  return (
    <div className="space-y-4 overflow-auto">
      <h3 className="text-sm font-semibold text-foreground">Step</h3>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Título</Label>
          <Input
            className="mt-1"
            value={step.title ?? ""}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Título do step"
          />
        </div>
        <div>
          <Label className="text-xs">Ícone (emoji)</Label>
          <Input
            className="mt-1"
            value={step.icon ?? ""}
            onChange={(e) => onUpdate({ icon: e.target.value })}
            placeholder="📌"
          />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Input
            className="mt-1"
            value={step.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Descrição opcional"
          />
        </div>
        <VisibilityRulesEditor
          rules={step.visibility ?? []}
          fieldIds={fieldIds}
          onChange={(rules) => onUpdate({ visibility: rules })}
        />
      </div>
    </div>
  );
}
