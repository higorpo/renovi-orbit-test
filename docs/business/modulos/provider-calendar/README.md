# Calendário do prestador (`provider-calendar`)

## 1. Leitura para negócio

- **Para que serve:** mostrar ao **prestador** a **agenda de serviços contratados** (não cancelados) em vista de **lista diária** (mobile) ou **grade mensal** (desktop), com turnos manhã / tarde / dia inteiro.
- **Quem usa:** prestadores autenticados (`profiles.role === provider`), com rota guard provider-only.
- **Não é:** calendário de disponibilidade editável, CRUD de agenda nem lista de oportunidades (`provider-jobs`). Também não reagenda serviços — só **consulta** datas já contratadas.
- **Valor:** visão temporal da carga de trabalho aceita/contratada, com atalho a partir de **Meus Serviços** e abertura do detalhe do serviço.
- **Entrada na UI:** banner “Ver calendário de serviços” em Meus Serviços do prestador; **não** há item próprio no menu lateral/bottom (`dashboardMenu.ts`).

## 2. Visão geral funcional

- **Objetivo:** listar `contracted_services` do prestador logado que **sobrepõem** um intervalo de datas, via RPC `list_provider_scheduled_services`.
- **Escopo:** página `/dashboard/services/calendar`, banner de entrada, navegação ao detalhe em `view-services`, chrome mobile em modo **stack**.
- **Limites:** somente leitura; exclusão de status `CANCELLED`; intervalo máximo de **42 dias** por chamada RPC; modo de vista **automático** por breakpoint (≥768px = grade; &lt;768px = lista) — sem toggle manual.
- **Relação:** depende de serviços já contratados (aceitação de proposta / pagamento); detalhe unificado em **view-services**; superfície de entrada em **my-services** (papel prestador).

## 3. Features do módulo

| Feature | Resumo | Documento |
|---------|--------|-----------|
| Calendário do prestador | Agenda lista/grade, RPC por intervalo, entrada via banner, abertura do detalhe | [features/calendario-do-prestador.md](./features/calendario-do-prestador.md) |

## 4. Perfis envolvidos

| Papel | Acesso |
|-------|--------|
| **Prestador** | Rota `ProtectedRoute allowedRoles={['provider']}`; RPC exige `profiles.role = provider` |
| **Cliente / visitante / admin** | Sem UI; cliente autenticado que chame a RPC recebe erro `Provider access only` (pgTAP) |
| **KYC incompleto** | Mesmo gate do shell (`provider-kyc`): conteúdo operacional do dashboard (incl. Meus Serviços → calendário) só após onboarding `ACTIVE` — evidência do gate no layout, não de regra específica neste módulo |

## 5. Principais fluxos

1. Prestador em **Meus Serviços** → toca banner → `/dashboard/services/calendar`.
2. App escolhe vista lista (mobile) ou grade (desktop) pelo breakpoint.
3. Front busca intervalos via RPC; lista faz *infinite scroll* bidirecional; grade navega mês a mês.
4. Toque em chip/barra → navega para `/dashboard/services/:id` com `returnTo` = calendário (página cheia, **sem** sheet).

## 6. Regras transversais

- Só serviços do `auth.uid()` como `contracted_services.provider_id`.
- Exclui `status = CANCELLED`.
- Sobreposição de intervalo: `scheduled_start_date <= to` e `coalesce(scheduled_end_date, start) >= from`.
- Span máximo por request: 42 dias (`MAX_RANGE_DAYS` / `v_max_span`).

## 7. Entidades

- `contracted_services` (datas, turno, status, `provider_id`)
- `service_requests` (título do pedido)
- `platform_services` (título / `color_key` — retornados pela RPC; **cor não usada na UI atual**)
- Enum/turno: `scheduled_shift` ∈ `morning` | `afternoon` | `full_day`

## 8. Integrações

- **Supabase RPC** `list_provider_scheduled_services` (SECURITY DEFINER, `GRANT` a `authenticated`).
- **view-services:** `getServiceDetailPath`, `createProviderCalendarServiceDetailState`.
- **my-services:** consome `ProviderCalendarEntryBanner` na página do prestador.
- **dashboard-shell / mobile chrome:** stack “Calendário”, `backFallback` → `/dashboard/services`.
- Sem Edge Function, e-mail, push ou analytics específicos neste módulo (não encontrados no código da feature).

## 9. Riscos e lacunas

- Sem item de menu dedicado — descoberta depende do banner em Meus Serviços.
- `platform_service_color_key` e `status` vêm da API mas **não** influenciam chips/barras na UI.
- Detalhe a partir do calendário **não** usa apresentação sheet (diferente de Meus Serviços / Trabalhos).
- Constantes `LIST_INITIAL_*` existem; janela inicial efetiva está em `getInitialListRange` (hoje −7 / +13 dias).

## 10. Evidências

- `src/features/provider-calendar/`
- `src/router.tsx` — `path: 'services/calendar'`, lazy `ProviderCalendarPage`, guard provider
- `src/features/my-services/components/provider/ProviderMyServicesPage.tsx` — banner
- `src/layouts/DashboardLayout/mobileNavigation.config.ts` — stack Calendário
- `src/layouts/DashboardLayout/dashboardMenu.ts` — **sem** item Calendário
- `supabase/migrations/20260712130000_list_provider_scheduled_services.sql`
- `supabase/tests/provider-calendar/list_provider_scheduled_services_test.sql`
