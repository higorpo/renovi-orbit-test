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
import type { FormSchema } from "../../types";

interface InspectorSchemaProps {
  schema: FormSchema;
  onUpdate: (updates: Partial<Pick<FormSchema, "id" | "title" | "description" | "metadata" | "config">>) => void;
}

export function InspectorSchema({ schema, onUpdate }: InspectorSchemaProps) {
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
            onChange={(e) => onUpdate({ id: e.target.value })}
            placeholder="ex: demo-all-blocks"
          />
        </div>
        <div>
          <Label className="text-xs">Título</Label>
          <Input
            className="mt-1"
            value={schema.title ?? ""}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Título do formulário"
          />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Input
            className="mt-1"
            value={schema.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
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
                onUpdate({ metadata: { ...meta, categorySlug: e.target.value } })
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
                onUpdate({
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
                onUpdate({ metadata: { ...meta, status: v } })
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
                onUpdate({ config: { ...config, showProgressBar: v } })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
