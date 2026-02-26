import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { VisibilityRule, VisibilityOperator } from "../../types";
import { createDefaultVisibilityRule, VISIBILITY_OPERATORS } from "./builderDefaults";

interface VisibilityRulesEditorProps {
  rules: VisibilityRule[];
  fieldIds: string[];
  onChange: (rules: VisibilityRule[]) => void;
}

export function VisibilityRulesEditor({
  rules,
  fieldIds,
  onChange,
}: VisibilityRulesEditorProps) {
  const updateRule = (index: number, updates: Partial<VisibilityRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addRule = () => {
    onChange([...rules, createDefaultVisibilityRule()]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Regras de visibilidade</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addRule} className="h-7 text-xs">
          <Plus className="w-3 h-3 mr-1" />
          Adicionar
        </Button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma regra. Bloco/step sempre visível.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-muted/30 p-2 space-y-2"
            >
              <div className="grid grid-cols-[1fr,1fr] gap-2">
                <div>
                  <Label className="text-xs">Campo (dependsOn)</Label>
                  <Select
                    value={rule.dependsOn || ""}
                    onValueChange={(v) => updateRule(index, { dependsOn: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldIds.map((id) => (
                        <SelectItem key={id} value={id} className="text-xs">
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Operador</Label>
                  <Select
                    value={rule.operator}
                    onValueChange={(v) => updateRule(index, { operator: v as VisibilityOperator })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {rule.operator !== "isEmpty" && rule.operator !== "isNotEmpty" && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      className="h-8 text-xs"
                      value={
                        Array.isArray(rule.value)
                          ? (rule.value as string[]).join(", ")
                          : String(rule.value ?? "")
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (rule.operator === "in" || rule.operator === "notIn") {
                          updateRule(index, { value: v.split(",").map((s) => s.trim()).filter(Boolean) });
                        } else if (rule.operator === "greaterThan" || rule.operator === "lessThan") {
                          updateRule(index, { value: v === "" ? undefined : Number(v) });
                        } else {
                          updateRule(index, { value: v || undefined });
                        }
                      }}
                      placeholder="Valor ou valores (separados por vírgula)"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRule(index)}
                    aria-label="Remover regra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
