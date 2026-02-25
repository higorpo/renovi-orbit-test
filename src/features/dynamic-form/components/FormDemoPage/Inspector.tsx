/**
 * Inspector — edit selected step or block properties in real time.
 */

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FormStepV2,
  FormBlockV2,
  FormSchemaV2,
  VisibilityRule,
  VisibilityOperator,
} from "@/features/dynamic-form/types";
import {
  VISIBILITY_OPERATORS,
  createDefaultVisibilityRule,
  BLOCK_TYPE_LABELS,
} from "./builderDefaults";

interface InspectorProps {
  schema: FormSchemaV2;
  selectedStep: FormStepV2 | null;
  selectedBlock: FormBlockV2 | null;
  selectionType: "schema" | "step" | "block" | null;
  stepId: string | null;
  blockId: string | null;
  onUpdateSchemaRoot: (updates: Partial<Pick<FormSchemaV2, "id" | "title" | "description" | "metadata" | "config">>) => void;
  onUpdateStep: (stepId: string, updates: Partial<FormStepV2>) => void;
  onUpdateBlock: (stepId: string, blockId: string, updates: Partial<FormBlockV2>) => void;
}

function allBlockIds(schema: FormSchemaV2): string[] {
  const ids: string[] = [];
  schema.steps.forEach((s) => s.blocks.forEach((b) => ids.push(b.id)));
  return ids;
}

function VisibilityRulesEditor({
  rules,
  fieldIds,
  onChange,
}: {
  rules: VisibilityRule[];
  fieldIds: string[];
  onChange: (rules: VisibilityRule[]) => void;
}) {
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
    const meta = schema.metadata;
    const config = schema.config;
    return (
      <div className="space-y-4 overflow-auto">
        <h3 className="text-sm font-semibold text-foreground">Configuração do formulário</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">ID do schema</Label>
            <Input
              className="mt-1 font-mono text-xs"
              value={schema.id}
              onChange={(e) => onUpdateSchemaRoot({ id: e.target.value })}
              placeholder="ex: demo-all-blocks"
            />
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              className="mt-1"
              value={schema.title ?? ""}
              onChange={(e) => onUpdateSchemaRoot({ title: e.target.value })}
              placeholder="Título do formulário"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              className="mt-1"
              value={schema.description ?? ""}
              onChange={(e) => onUpdateSchemaRoot({ description: e.target.value })}
              placeholder="Descrição opcional"
            />
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <Label className="text-xs font-medium">Metadata</Label>
            <div>
              <Label className="text-xs text-muted-foreground">categorySlug</Label>
              <Input
                className="mt-1"
                value={meta.categorySlug ?? ""}
                onChange={(e) =>
                  onUpdateSchemaRoot({ metadata: { ...meta, categorySlug: e.target.value } })
                }
                placeholder="ex: demo-form"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">categoryId</Label>
              <Input
                className="mt-1"
                value={meta.categoryId ?? ""}
                onChange={(e) =>
                  onUpdateSchemaRoot({
                    metadata: { ...meta, categoryId: e.target.value || null },
                  })
                }
                placeholder="null ou ID"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">status</Label>
              <Select
                value={meta.status ?? "draft"}
                onValueChange={(v: "draft" | "active" | "deprecated") =>
                  onUpdateSchemaRoot({ metadata: { ...meta, status: v } })
                }
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="deprecated">deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <Label className="text-xs font-medium">Config</Label>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">showProgressBar</Label>
              <Switch
                checked={config.showProgressBar ?? true}
                onCheckedChange={(v) =>
                  onUpdateSchemaRoot({ config: { ...config, showProgressBar: v } })
                }
              />
            </div>
          </div>
        </div>
      </div>
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
      <div className="space-y-4 overflow-auto">
        <h3 className="text-sm font-semibold text-foreground">Step</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              className="mt-1"
              value={selectedStep.title ?? ""}
              onChange={(e) => onUpdateStep(stepId, { title: e.target.value })}
              placeholder="Título do step"
            />
          </div>
          <div>
            <Label className="text-xs">Ícone (emoji)</Label>
            <Input
              className="mt-1"
              value={selectedStep.icon ?? ""}
              onChange={(e) => onUpdateStep(stepId, { icon: e.target.value })}
              placeholder="📌"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              className="mt-1"
              value={selectedStep.description ?? ""}
              onChange={(e) => onUpdateStep(stepId, { description: e.target.value })}
              placeholder="Descrição opcional"
            />
          </div>
          <VisibilityRulesEditor
            rules={selectedStep.visibility ?? []}
            fieldIds={fieldIds}
            onChange={(rules) => onUpdateStep(stepId, { visibility: rules })}
          />
        </div>
      </div>
    );
  }

  if (selectionType === "block" && selectedBlock && blockId) {
    const block = selectedBlock;
    const update = (updates: Partial<FormBlockV2>) => onUpdateBlock(stepId, blockId, updates);

    return (
      <div className="space-y-4 overflow-auto">
        <h3 className="text-sm font-semibold text-foreground">
          {BLOCK_TYPE_LABELS[block.type]}
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">ID</Label>
            <Input
              className="mt-1 font-mono text-xs"
              value={block.id}
              onChange={(e) => update({ id: e.target.value })}
              placeholder="block_id"
            />
          </div>
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              className="mt-1"
              value={block.label ?? ""}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Rótulo do campo"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Obrigatório</Label>
            <Switch
              checked={block.required ?? false}
              onCheckedChange={(v) => update({ required: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Placeholder</Label>
            <Input
              className="mt-1"
              value={block.placeholder ?? ""}
              onChange={(e) => update({ placeholder: e.target.value })}
              placeholder="Placeholder"
            />
          </div>
          <div>
            <Label className="text-xs">Texto de ajuda</Label>
            <Input
              className="mt-1"
              value={block.helpText ?? ""}
              onChange={(e) => update({ helpText: e.target.value })}
              placeholder="Help text"
            />
          </div>

          {(block.type === "number" || block.type === "slider") && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={block.min ?? ""}
                    onChange={(e) =>
                      update({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={block.max ?? ""}
                    onChange={(e) =>
                      update({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Step</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={block.step ?? ""}
                    onChange={(e) =>
                      update({ step: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Input
                  className="mt-1"
                  value={block.unit ?? ""}
                  onChange={(e) => update({ unit: e.target.value })}
                  placeholder="ex: m², un"
                />
              </div>
            </>
          )}

          {(block.type === "single_select" ||
            block.type === "multi_select" ||
            block.type === "radio" ||
            block.type === "checkbox") && (
            <div>
              <Label className="text-xs">Opções (JSON array)</Label>
              <textarea
                className={cn(
                  "mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                )}
                value={JSON.stringify(block.options ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "[]");
                    if (Array.isArray(parsed)) update({ options: parsed });
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
                placeholder='[{"value":"a","label":"Opção A"}]'
              />
            </div>
          )}

          {block.type === "static_text" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Variante</Label>
                <Select
                  value={(block.config?.variant as string) ?? "p"}
                  onValueChange={(v) =>
                    update({ config: { ...block.config, variant: v } })
                  }
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["h1", "h2", "h3", "h4", "p"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Select
                  value={(block.config?.color as string) ?? "default"}
                  onValueChange={(v) =>
                    update({ config: { ...block.config, color: v } })
                  }
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["default", "muted", "primary", "destructive", "success"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {block.type === "conditional_alert" && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Tipo do alerta</Label>
                <Select
                  value={(block.config?.alertType as string) ?? "info"}
                  onValueChange={(v) =>
                    update({ config: { ...block.config, alertType: v } })
                  }
                >
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["info", "warning", "success"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Título do alerta</Label>
                <Input
                  className="mt-1"
                  value={(block.config?.alertTitle as string) ?? ""}
                  onChange={(e) =>
                    update({ config: { ...block.config, alertTitle: e.target.value } })
                  }
                  placeholder="Título"
                />
              </div>
            </div>
          )}

          {block.type === "single_select" && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">Permitir &quot;Outro&quot;</Label>
              <Switch
                checked={(block.config?.allowOther as boolean) ?? false}
                onCheckedChange={(v) =>
                  update({ config: { ...block.config, allowOther: v } })
                }
              />
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <VisibilityRulesEditor
              rules={block.visibility ?? []}
              fieldIds={fieldIds}
              onChange={(rules) => update({ visibility: rules })}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
