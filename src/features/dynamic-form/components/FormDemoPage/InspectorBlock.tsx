import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormBlock, FormBlockType } from "../../types";
import { BLOCK_TYPE_LABELS } from "./builderDefaults";
import { VisibilityRulesEditor } from "./VisibilityRulesEditor";

interface InspectorBlockProps {
  block: FormBlock;
  stepId: string;
  blockId: string;
  fieldIds: string[];
  onUpdate: (updates: Partial<FormBlock>) => void;
}

export function InspectorBlock({
  block,
  fieldIds,
  onUpdate,
}: InspectorBlockProps) {
  const update = onUpdate;

  return (
    <div className="space-y-4 overflow-auto">
      <h3 className="text-sm font-semibold text-foreground">
        {BLOCK_TYPE_LABELS[block.type as FormBlockType]}
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
        <div>
          <Label className="text-xs">Descrição para IA</Label>
          <textarea
            className={cn(
              "mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-xs"
            )}
            value={block.description_ai ?? ""}
            onChange={(e) => update({ description_ai: e.target.value })}
            placeholder="O que é este dado e como a IA deve interpretá-lo"
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
