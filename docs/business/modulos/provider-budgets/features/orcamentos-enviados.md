# Orçamentos enviados pelo prestador

## 1. Resumo executivo

- **O que é:** painel do **prestador** para acompanhar **propostas já enviadas** e **perguntas** feitas aos clientes, com filtros, busca, paginação e contadores de pendentes.
- **Problema que resolve:** gestão do pipeline após o primeiro contato sem misturar com a lista de novas oportunidades.
- **Quem usa:** prestador.
- **Resultado esperado:** visão consolidada do que está aguardando resposta do cliente.

## 2. Objetivo de negócio

- **Finalidade:** produtividade do prestador em negociações múltiplas.
- **Valor:** menos perda de follow-up.
- **Impacto:** leitura de `provider_proposals` e `provider_service_request_questions` filtradas pelo prestador.
- **Contexto:** complementa `provider-jobs` (descoberta e envio).

## 3. Localização na plataforma

| Rota | Uso |
|------|-----|
| `/dashboard/budgets` | Lista principal |
| `/dashboard/budgets/pedido/:serviceRequestId` | Contexto filtrado por pedido |

Componentes: `ProviderBudgetsShell`, `ProviderBudgetsRouteSlot`, `ProviderBudgetsPage`.

## 4. Perfis envolvidos

- **Prestador:** único.
- **Cliente:** vê espelho em `client-budgets`.

## 5. Fluxo funcional principal

1. Prestador abre “Orçamentos”.
2. Alterna abas (enviados vs perguntas — conforme UI).
3. Aplica filtros/busca.
4. Abre item para ver detalhe contextualizado.

## 6. Fluxos alternativos e exceções

- **Carregar mais** para grandes volumes.
- **Erro de rede:** feedback padrão da camada de dados.

## 7. Regras de negócio

1. Dados restritos ao `provider_id` autenticado (RPC).
2. Contadores de pendentes refletem estado das perguntas/propostas — **lógica exata nos RPCs** (evidência parcial neste texto).

## 8. Campos e dados

Dados exibidos espelham `provider_proposals` e threads de perguntas (valores, status, títulos de pedido, etc.). **Tabela fina de colunas:** extrair de `ProviderBudgetsPage` e tipos retornados.

## 9. Validações de front-end

- Parâmetros de filtro/página validados antes da chamada.

## 10. Validações de back-end

- `list_provider_sent_budgets`, `list_provider_own_questions` (`20260322000000_create_provider_budgets_rpcs.sql` e relacionadas).

## 11. Status, estados e transições

- Proposta: `submitted`, `accepted`, `rejected`, `withdrawn`.
- **Withdrawn** permite nova proposta ativa (índice único parcial na migration de propostas).

## 12. Persistência

- `provider_proposals`, `provider_service_request_questions`.

## 13. Integrações

- Somente Supabase RPC/select.

## 14. Listagens, buscas e filtros

- Busca, filtros de status, ordenação implícita do RPC, paginação.

## 15. Ações disponíveis

| Ação | Quem | Resultado |
|------|------|-----------|
| Listar enviados | Prestador | Visão consolidada |
| Listar perguntas próprias | Prestador | Follow-up |
| Filtrar por pedido | Prestador | Rota com `serviceRequestId` |

## 16. Dependências

- Depende de propostas criadas em `provider-jobs`.
- Cliente deve interagir para mudar estados em vários casos.

## 17. Regras implícitas

- Separação UX entre “Trabalhos” (aquisição) e “Orçamentos” (pós-envio).

## 18. Riscos

- Duplicação mental com lista de jobs se nomes de menu não forem treinados.

## 19. Evidências

- `src/features/provider-budgets/`
- `src/router.tsx`
- `supabase/migrations/20260322000000_create_provider_budgets_rpcs.sql`

## 20. Pendências

- Documentar parâmetros exatos de cada RPC e significado de cada filtro na UI.
