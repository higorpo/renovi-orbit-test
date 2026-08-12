# Trabalhos do prestador (`provider-jobs`)

## 1. Leitura para negócio

- **Para que serve:** o prestador vê **oportunidades liberadas pelo matching progressivo** (lote ou mercado aberto), **descarta** cards, abre o **detalhe** em `/dashboard/services/:id` e segue para **chat / orçamento**.
- **Quem usa:** apenas **prestador** autenticado.
- **Valor:** liquidez controlada — só aparecem pedidos com **visibilidade** concedida pelo dispatch.
- **Riscos de suporte:** confundir GPS de **feed** (sort *Mais próximos*) com **beacon** (elegibilidade em lote); prestador **suspended** vê feed vazio sem mensagem específica; **DISPATCH_STOPPED** bloqueia **nova proposta**, não o início de chat.

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Lista | `/dashboard/jobs` — persistent slot + Edge **`list-provider-opportunities`** → RPC `list_provider_opportunities` |
| Paginação | Cursor opaco; **20** itens/página (máx. 50) |
| Sort | `nearest` (exige GPS feed), `newest`, `least_competitive` — **sem** filtro de raio/serviço na UI |
| Descartar | RPC **`dismiss_provider_opportunity`** (batch ou `fallback_dismiss`) |
| Detalhe | **`view-services`** — sheet com `returnTo: /dashboard/jobs` ou full-page |
| Proposta / chat | **`negotiation-proposals`** + **`chats`** (entrada via detalhe; `provider-jobs` não importa o composer) |
| Beacon | **`device-beacon`** — elegibilidade geográfica de lote; samples para GPS nativo no feed |

## 3. Features do módulo

| Documento | Conteúdo |
|-----------|----------|
| [features/trabalhos-e-propostas.md](./features/trabalhos-e-propostas.md) | 20+ seções: feed, geo dupla, dismiss, gates, integração detalhe/proposta, legado |
| [matching-dispatch](../matching-dispatch/README.md) | Backend: lotes, cron, gates, visibilidade (não editar neste módulo) |

## 4. Perfis envolvidos

| Perfil | Acesso |
|--------|--------|
| Prestador ativo | Lista, dismiss, detalhe, chat, proposta |
| Prestador `operational_status = suspended` | Edge devolve feed **vazio** (HTTP 200) |
| Cliente / visitante | Sem rota `jobs` (guard provider) |

## 5. Principais fluxos

1. Abrir Trabalhos → GPS feed (opcional) → listar oportunidades → ordenar / carregar mais.
2. Card → detalhe sheet (lista montada) → FAB **Iniciar/Ver negociação** → chat → orçamento.
3. Menu card → **Não tenho interesse** → some do feed (idempotente no servidor).

Diagrama detalhado: [trabalhos-e-propostas §5](./features/trabalhos-e-propostas.md#5-fluxo-funcional-principal).

## 6. Regras transversais

- Visibilidade só via matching progressivo (não “todos os OPEN”).
- Dois papéis de localização (beacon vs GPS feed) — ver feature §7 e device-beacon.
- Gates STOPPED/PAUSED e status de dispatch: matching-dispatch.
- Perguntas ao cliente **removidas** do produto (migration `20260703170000_…`).

## 7. Entidades

| Entidade / contrato | Papel |
|---------------------|-------|
| `ListProviderOpportunityItem` | Shape do card (contract compartilhado Edge/front) |
| `service_request_provider_visibility` | Grant batch / marcador dismiss fallback |
| `service_request_dispatches` | Lifecycle e gates (leitura indireta) |
| `provider_proposals` / `chats` | Pós-detalhe (outros módulos) |

## 8. Integrações

| Módulo | Relação |
|--------|---------|
| `matching-dispatch` | Concede visibilidade; STOPPED em proposta |
| `device-beacon` | Beacon + samples GPS |
| `view-services` | Detalhe unificado + audit view + FAB |
| `chats` / `negotiation-proposals` | Negociação e orçamento |
| `settings` | Serviços e bairros (elegibilidade) |
| `message-dispatcher` | Template `matching.new_opportunity` |

## 9. Riscos e lacunas

- Empty de suspended indistinguível de “sem oportunidades na região”.
- Copy do empty com filtros ainda cita “raio”.
- `DISPATCH_STOPPED` sem mensagem amigável mapeada em `proposalApiErrors`.
- RPC/Edge legado `match_provider_jobs` / pasta vazia — ver anexo legado na feature.
- Pendências completas: [trabalhos-e-propostas §20](./features/trabalhos-e-propostas.md#20-pendências).

## 10. Evidências

| Área | Paths |
|------|-------|
| Lista / hooks / API | `src/features/provider-jobs/` |
| Edge | `supabase/functions/list-provider-opportunities/` |
| Contract | `supabase/functions/_shared/contracts/list-provider-opportunities/` |
| Layout | `ProviderJobsPersistentSlot` em `DashboardLayout.tsx` |
| SQL | `20260711110000_matching_feed_audit_rpcs.sql` (+ feed offered-service) |
