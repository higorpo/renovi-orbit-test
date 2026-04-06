# Motor de formulários dinâmicos

## 1. Resumo executivo

- **O que é:** biblioteca de UI + lógica para renderizar **formulários multi-etapa** a partir de um **schema JSON** versionado, com visibilidade condicional, validação por bloco e barra de progresso.
- **Problema que resolve:** mudar perguntas de serviço **sem alterar código** do wizard principal.
- **Quem usa:** principalmente o fluxo **Pedir orçamento**; desenvolvedores em **`/demo/form` (somente DEV)**.
- **Resultado esperado:** objeto de dados estruturado + schema/versiono enviados ao backend no pedido.

## 2. Objetivo de negócio

- **Finalidade:** flexibilidade de catálogo de serviços.
- **Valor:** time de produto/ops pode evoluir formulários via dados (`platform_forms`).
- **Impacto:** qualidade da descrição do pedido e insumos para IA.
- **Contexto:** serviços referenciam `form_id` em `platform_services`.

## 3. Localização na plataforma

| Aspecto | Detalhe |
|---------|---------|
| Módulo | `dynamic-form` |
| Rota DEV | `/demo/form` |
| Consumidor principal | `request-quote` Step 2 (`Step2ServiceForm`) |
| API HTTP própria | Não — schema vem de `getFormById` / serviço |

## 4. Perfis envolvidos

- **Visitante/cliente** no pedido.
- **Admin** implícito como mantenedor dos schemas no banco (fora do escopo UI deste módulo).

## 5. Fluxo funcional principal

```mermaid
flowchart LR
  A[Recebe schema + versão] --> B[FormProvider]
  B --> C[Steps visíveis]
  C --> D[StepRenderer / blocos]
  D --> E[Validação por campo/bloco]
  E --> F[Resumo / completude]
  F --> G[Callback para container pai]
```

## 6. Fluxos alternativos e exceções

- **Schema inválido:** `SchemaError` / falhas de validação de estrutura (`validateFormSchema`).
- **Regras de visibilidade:** blocos pulados conforme `evaluateVisibilityRule`.
- **Skeleton:** `DynamicFormSkeleton` durante carregamento.

## 7. Regras de negócio

1. Formulário associado a **versão** para compatibilidade de dados históricos.
2. `platform_forms.form_status`: apenas formulários **active** devem ser usados em produção (**comportamento inferido** — confirmar enforcement na API de serviços).
3. Validação combina **tipo de bloco** + mensagens via `getValidationErrorMessage`.

## 8. Campos e dados

Os campos **não são fixos**: cada serviço define blocos no JSON. Para documentação de negócio, cada serviço deveria ter anexo com snapshot do schema.

| Conceito | Descrição |
|----------|-----------|
| Bloco | Unidade de entrada com tipo e validação |
| Step | Agrupamento de blocos |
| Visibilidade | Regra opcional que mostra/oculta blocos |
| Progresso | Derivado de passos visíveis e completos |

## 9. Validações de front-end

- `useFieldValidation`, `validateBlockValue`.
- Mensagens centralizadas em helpers de erro.

## 10. Validações de back-end

- **Evidência parcial:** servidor armazena `form_data` / schema em `service_requests` — validação server-side na Edge `create-request-quote-order` deve ser verificada no handler (não detalhado linha a linha neste doc).

## 11. Status, estados e transições

- **Formulário de plataforma:** `draft` → `active` → `deprecated` (tabela `platform_forms`).
- **UI:** passo atual, passo anterior, completude.

## 12. Persistência

- Definição: `platform_forms`.
- Respostas: persistidas no fluxo de **pedido**, não pelo motor isoladamente.

## 13. Integrações

- Dados do formulário alimentam **generate-smart-description** (contexto).

## 14. Listagens, buscas e filtros

- N/A.

## 15. Ações disponíveis

| Ação | Quem | Resultado |
|------|------|-----------|
| Avançar passo | Usuário | Valida blocos atuais |
| Voltar | Usuário | Navegação interna |
| Ver resumo | Usuário | `buildSummarySections` / completude |

## 16. Dependências

- Container deve fornecer schema, versão, callbacks de mudança.
- Tipos em `dynamic-form/types`.

## 17. Regras implícitas

- `getVisibleSteps` altera o fluxo real percebido pelo usuário vs schema bruto.

## 18. Riscos

- Schema mal publicado pode quebrar o wizard em produção.
- Divergência front vs back se versão/schema não forem validados no servidor.

## 19. Evidências

- `src/features/dynamic-form/components/DynamicForm.tsx`, `FormProvider`, `StepRenderer`
- `src/features/dynamic-form/hooks/useFieldValidation.ts`
- Helpers: `getVisibleSteps`, `evaluateVisibilityRule`, `validateFormSchema`
- `supabase/migrations/20260226100000_create_forms.sql`
- `src/router.tsx` (rota demo DEV)

## 20. Pendências

- Catálogo por serviço com **print/schema** aprovado pelo negócio.
- Auditoria da **validação na Edge Function** de criação de pedido.
