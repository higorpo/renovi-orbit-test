# Orçamentos do prestador (`provider-budgets`)

## 1. Leitura para negócio

- **Para que serve:** depois de enviar orçamentos ou perguntas em **Trabalhos**, o prestador **acompanha** tudo em um só lugar: status da proposta, respostas do cliente e contexto do pedido, com busca e filtros.
- **Quem usa:** apenas **prestador** autenticado.
- **Valor:** reduz perda de follow-up em várias negociações paralelas.
- **Risco de suporte:** diferenciar mentalmente **Trabalhos** (oportunidades novas) e **Orçamentos** (já interagiu); contadores do topo ajudam (“aguardando aprovação”, “perguntas aguardando resposta”).

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rotas | `/dashboard/budgets`, `/dashboard/budgets/pedido/:serviceRequestId` |
| Lista | RPCs `list_provider_sent_budgets`, `list_provider_own_questions` — paginação **20**, busca server-side |
| Detalhe | Reutiliza **`JobDetailSheet` / `JobDetailPage`** de `provider-jobs`; query `?from=budgets` para voltar |
| Segurança | RPCs `SECURITY DEFINER`; escopo `auth.uid()` e `role = provider` (ver migration) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/orcamentos-enviados.md](./features/orcamentos-enviados.md) | Rotas, abas, filtros, debounce, parâmetros RPC, campos SQL de busca, cards, mapeamento para detalhe, mensagens, lacuna do filtro `closed` |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Página e shell | `components/ProviderBudgetsPage.tsx`, `ProviderBudgetsShell.tsx` |
| API | `api/providerBudgets.api.ts` |
| Hooks | `hooks/useProviderSentBudgets.ts`, `useProviderOwnQuestions.ts`, `useProviderBudgetsFilters.ts`, `useProviderPendingApprovalBudgetsCount.ts`, `useProviderPendingQuestionsCount.ts` |
| UI | `BudgetsHeader.tsx`, `BudgetsFilterChips.tsx`, `BudgetCard.tsx`, `QuestionCard.tsx`, skeletons, `BudgetsEmptyState.tsx`, `BudgetsErrorState.tsx` |
| Tipos / labels | `types/provider-budgets.types.ts`, `constants/budgetStatus.ts` |
| Navegação para job | `utils/initialProviderJobItem.ts` |

## 5. Integrações

- **`provider-jobs`:** componentes de detalhe + constantes de retorno (`jobDetailReturnNavigation.ts`).
- **`request-quote`:** fotos e estilo de serviço nos cards.

## 6. Migração de referência

- `supabase/migrations/20260322000000_create_provider_budgets_rpcs.sql` — definição completa das duas RPCs, comentários de segurança e mapeamento `pending` / `answered` / `closed`.

## 7. API pública do pacote

- `index.ts` exporta apenas `ProviderBudgetsPage` (o router importa `ProviderBudgetsShell` pelo caminho do arquivo).
