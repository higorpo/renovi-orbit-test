# Trabalhos do prestador (`provider-jobs`)

## 1. Leitura para negócio

- **Para que serve:** o prestador **encontra pedidos abertos** compatíveis (serviço ofertado, área de atuação, distância), abre o **detalhe**, pode **perguntar** ao cliente (até **3** perguntas por pedido, conforme tratamento de erro no front) e **envia ou edita** **orçamento** com cálculo de taxa e assinatura no banco.
- **Quem usa:** apenas **prestador** autenticado.
- **Valor:** liquidez do marketplace no lado da oferta.
- **Riscos:** matching depende de **geolocalização** (ou fallback Florianópolis / centróide BR no detalhe), configuração em **Minha conta** (serviços e bairros) e regras SQL; suporte deve saber onde o prestador ajusta raio e filtros na própria lista.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rotas | `/dashboard/jobs`, `/dashboard/jobs/:jobId` (sheet ou página conforme `location.state`) |
| Lista | Edge **`match-provider-jobs`** → RPC `match_provider_jobs`; página **20** itens; infinite query |
| Detalhe | RPC **`get_provider_proposal_job_detail`** |
| Proposta | RPCs **`calculate_provider_service_pricing`**, **`create_provider_proposal`**; storage **`provider-proposals`** |
| Perguntas | RPCs **`create_provider_service_request_question`**, **`list_provider_service_request_questions`** |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/trabalhos-e-propostas.md](./features/trabalhos-e-propostas.md) | Telas, geo, critérios de matching (Edge), sort modes, filtros, perguntas, composer de proposta, mensagens, APIs, lacunas |

## 4. Arquivos-chave (mapa rápido)

| Área | Caminhos |
|------|----------|
| Shell / rotas internas | `components/ProviderJobsShell.tsx`, `ProviderJobsRouteSlot.tsx` |
| Lista | `ProviderJobsPage.tsx`, `JobCard.tsx`, `JobsHeader.tsx`, `JobsSortTabs.tsx`, `JobsFiltersBar.tsx` |
| Estados lista | `JobsEmptyState.tsx`, `JobsErrorState.tsx`, `LocationPermissionBanner.tsx` |
| Detalhe | `JobDetailPage.tsx`, `JobDetailSheet.tsx`, `JobDetailContent.tsx`, `JobDetailFloatingActions.tsx` |
| Proposta | `ProviderProposalComposerDialog.tsx`, `useProviderProposalComposer.ts`, `ProviderProposalSummaryCard.tsx` |
| Perguntas | `JobQuestionComposerDialog.tsx`, `JobQuestionPromptCard.tsx`, `JobQuestionsFeed.tsx`, `useProviderJobQuestionComposer.ts` |
| Tipos / constantes | `types/provider-jobs.types.ts`, `constants/sortModes.ts`, `constants/queryKeys.ts` |
| Geo | `hooks/useProviderLocation.ts` |
| Lista remota | `hooks/useProviderJobs.ts`, `api/providerJobs.api.ts` |

## 5. Edge Function (referência)

- Código e comentários de negócio: `supabase/functions/match-provider-jobs/index.ts` (auth `profile.role = provider`, validação de coords, elegibilidade, `sort_mode`, paginação).

## 6. Migrações e SQL (referência)

- Matching / propostas: ex. `supabase/migrations/20260318200001_match_provider_jobs_rpc.sql`, `20260318200000_create_provider_proposals.sql`, hardening de assinatura em migrações posteriores (ver grep por `create_provider_proposal` / `pricing_signature`).

## 7. Relação com outros módulos

- **`my-account`:** serviços ofertados e bairros alimentam o matching (ver comentários na Edge).
- **`provider-budgets`:** reutiliza `JobDetailSheet` / `JobDetailPage` e navegação de retorno (`constants/jobDetailReturnNavigation.ts`).
- **`request-quote`:** fotos do pedido na lista; estilos de card de serviço.
- **`client-budgets` / `client-my-services`:** lado cliente para respostas e orçamentos recebidos.
