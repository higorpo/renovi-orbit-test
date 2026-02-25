# Plano de migração: Motor de formulários dinâmicos (Renovi → Orbit)

## Objetivo
Migrar o sistema de formulários dinâmicos (micro-steps, schema-driven) do Renovi para o Orbit como feature `dynamic-form`, sem persistência de draft (local/DB), com código mais limpo e arquitetura extensível.

## Escopo migrado
| Origem (Renovi) | Destino (Orbit) |
|-----------------|-----------------|
| `types/formSchemaV2/*` | `features/dynamic-form/types/` |
| `lib/schemaValidator.ts` | `features/dynamic-form/utils/schemaValidator.ts` |
| `components/forms/engine/FormContext.tsx` | `features/dynamic-form/components/FormContext.tsx` |
| `components/forms/engine/MicroStepForm.tsx` (sem draft) | `features/dynamic-form/components/MicroStepForm/` |
| `components/forms/engine/MicroStepRenderer.tsx` | `features/dynamic-form/components/MicroStepRenderer.tsx` |
| `components/forms/engine/ProgressBar.tsx` | `features/dynamic-form/components/ProgressBar.tsx` |
| `components/forms/blocks/*` | `features/dynamic-form/components/blocks/` |
| `hooks/useFieldValidation.ts` | `features/dynamic-form/hooks/useFieldValidation.ts` |

## O que NÃO é migrado (por enquanto)
- `useFormDraft` e `useFormPersistence` (draft local e banco)
- Qualquer efeito em `MicroStepForm` / `FormContent` que chame load/save/clear draft
- `useFormLogger` (TextInputBlock): removido ou substituído por `@/lib/logger` se necessário

## Melhorias de arquitetura
1. **Registry de blocos**: Em vez de um `switch` gigante no `MicroStepRenderer`, usar um mapa `blockType → Component` para facilitar extensão e testes.
2. **Componente de erro de schema**: Extrair `SchemaError` para arquivo próprio e usar em MicroStepForm.
3. **Tipos**: Manter `formSchemaV2` em módulo; adicionar `metadata?: Record<string, unknown>` em `SelectOption` para UrgencyBlock (slaHours).
4. **Validação**: `schemaValidator` em `utils/` da feature; comentários e mensagens em inglês.
5. **Single responsibility**: FormContent apenas orquestra navegação e submit; estado e micro-steps ficam no FormContext.
6. **Logger**: Em `lib/` usar `@/lib/logger`; na feature não usar console.
7. **TextareaBlock**: Usar `block.validation?.maxLength` (tipo já tem objeto validation).
8. **PreviewSummaryBlock**: Manter `onEdit` como callback opcional.

## Ordem de execução
1. Tipos → 2. schemaValidator → 3. useFieldValidation → 4. FormContext → 5. ProgressBar, SchemaError, MicroStepForm → 6. Blocos → 7. MicroStepRenderer → 8. index.ts e build.

## Estrutura final
```
src/features/dynamic-form/
├── components/
│   ├── blocks/
│   ├── FormContext.tsx
│   ├── MicroStepForm/ (MicroStepForm.tsx, MicroStepFormSkeleton.tsx, SchemaError.tsx)
│   ├── MicroStepRenderer.tsx
│   └── ProgressBar.tsx
├── hooks/useFieldValidation.ts
├── types/formSchemaV2/ (index, types, helpers, defaults)
├── utils/schemaValidator.ts
└── index.ts
```
