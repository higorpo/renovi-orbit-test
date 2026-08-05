# Visualização de serviços (`view-services`)

## 1. Leitura para negócio

- **Para que serve:** lista e detalhe unificados de um **pedido** (`service_request_id`) para cliente e prestador, com fase de produto (`list_phase`) calculada no servidor e um único shape (`ServiceModel`).
- **Quem usa:** cliente e prestador autenticados; a UI do detalhe muda por papel. Visitante não acessa (dashboard protegido).
- **Valor:** evita telas divergentes; centraliza badges, filtros de aba e ações contextuais (orçamentos, cancelar, republicar, pagamento, **conclusão via service-completion**, reagendar).
- **ID canônico:** `service_request_id` — rota `/dashboard/services/:id`.
- **Apresentação:** a partir de Meus Serviços / Trabalhos o detalhe abre em **sheet** (modal routing); deep link ou calendário abrem **página** (stack). Não é mais placeholder de dashboard.

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Lista | RPC `list_services` — paginação, filtros, `list_phase`; hook `useServicesList` |
| Detalhe | RPC `get_service`; hook `useService`; UI `ServiceDetailPage` |
| Shell de rota | `ServiceDetailShell` — `null` se sheet; senão página |
| Sheet | `ServiceDetailSheet` montado no `DashboardLayout` quando `useServiceDetailModal().isOpen` |
| Cancelamento pedido (cliente) | RPC `cancel_service_request` via `cancelService` |
| Republicação (cliente) | RPC `republish_cancelled_service_request` |
| Contrato | Tabela `contracted_services`; seção payments/reschedule; conclusão via **service-completion** (wizards) |
| Sem PostgREST list/detail | API TS só `supabase.rpc(...)` |

## 3. Features do módulo

| Documento | Conteúdo |
|-----------|----------|
| [features/visualizacao-de-servicos.md](./features/visualizacao-de-servicos.md) | 20+ seções: client vs provider, status UI, ações, shell/sheet/página, RPCs, listagens |

## 4. Perfis envolvidos

| Papel | Lista | Detalhe |
|-------|-------|---------|
| Cliente | Seus `service_requests` | Dono; ações de orçamento/cancel/republicar/pagamento/conclusão |
| Prestador | SRs com proposta **ou** contrato próprio (não o pool de jobs) | Mesmo acesso; proposta, chat FAB, local, executar, settlement |
| Admin SQL | Escopo admin nas RPCs | Sem UI admin neste módulo |

## 5. Principais fluxos

1. Lista em `my-services` → clique → navigate com state sheet → `ServiceDetailSheet`.
2. Deep link `/dashboard/services/:id` → `ServiceDetailPage` full-page / stack mobile.
3. Detalhe carrega `get_service` → seções por `listPhase` / `contracted` / role.
4. Cliente cancela pedido em negociação ou republica cancelado; prestador inicia/abre chat.

## 6. Regras transversais

- Fase (`negotiation` \| `in_progress` \| `completed` \| `cancelled`) só no SQL (`derive_service_list_phase`).
- Aba UI **Disputas** existe mas a API TS devolve lista vazia.
- Prestador vê nome do cliente **mascarado** no payload.
- Cards ricos de lista ficam em **my-services**; este módulo exporta `SimpleServiceCard` + detalhe.

## 7. Entidades

| Entidade | Papel |
|----------|--------|
| `service_requests` | Pedido — eixo do ID de rota |
| `contracted_services` | Contrato pós-aceite |
| `provider_proposals` | Escopo e contagens de orçamento |
| `ServiceModel` | Contrato front lista/detalhe |
| `payment_schedules` (via payments) | Estado para CTA “Ajustar pagamento” |

## 8. Integrações

- **my-services** — shell de listagem; persistent slots + navegação sheet.
- **provider-jobs** / **provider-calendar** — entry points de detalhe (sheet vs página).
- **negotiation-proposals** — sheet de orçamentos; composer no detalhe prestador.
- **chats** — conversas, initiate, botão chat contratado.
- **payments** / **service-reschedule** — ações na `ServiceContractedSection`.
- **service-completion** — banner enrichment; `ProviderExecutedWizard` / `ClientConfirmRatingWizard` (+ stub disputa no wizard); só Public API.
- **DashboardLayout** — hospeda `ServiceDetailSheet`.

## 9. Riscos e lacunas

- Índices transversais ainda podem citar `:id` como placeholder — **código já usa `ServiceDetailShell`**.
- Escopo prestador ≠ feed de oportunidades (`provider-jobs`).
- Disputas sem implementação de listagem.
- Detalhe a partir do calendário sem sheet (diferente de Meus Serviços) — ver doc provider-calendar.

## 10. Evidências

| Área | Caminhos |
|------|----------|
| Public API | `src/features/view-services/index.ts` |
| API | `api/services.api.ts`, `opportunityView.api.ts` (conclusão **não** vive mais em APIs locais de lifecycle) |
| Hooks | `useServicesList`, `useService`, `useCancelService`, `useRepublishCancelledService`, `useServiceDetailModal`, chat, budget sheet |
| UI | `ServiceDetailShell`, `ServiceDetailSheet`, `ServiceDetailPage` (compõe wizards de `service-completion`), `ServiceContractedSection`, `SimpleServiceCard`, … |
| Tipos / nav | `types/service.types.ts`, `types/serviceDetailNavigation.types.ts` |
| Constantes | `queryKeys.ts`, `routes.ts`, `statusTabs.ts`, `statusBadge.ts` |
| SQL | `20260705207000_*`, `20260705208000_*`, `20260705209000_*`, `20260802170000_republish_*` |
| Testes | `src/features/view-services/**/__tests__`, `supabase/tests/view-services/` |
