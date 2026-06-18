# Matching progressivo e dispatch de pedidos (backend)

## 1. Leitura para negócio

- **Para que serve:** quando um cliente abre um **pedido** (`OPEN`), a plataforma **não** mostra o pedido a todos os prestadores da região de uma vez. Um **dispatch** (`service_request_dispatches`) abre **lotes** de prestadores compatíveis ao longo do tempo, envia **notificações** (e-mail/push via Message Dispatcher) e controla **gates** de negócio (pausa, parada, expiração, mercado aberto).
- **Quem é afetado:** **prestadores** (feed em Trabalhos, notificações, elegibilidade para proposta); **clientes** (tempo até receber orçamentos); **operações** (cron, telemetria `job_runs`).
- **Valor:** reduz ruído no feed, prioriza proximidade e qualidade, alinha notificação à visibilidade.
- **Riscos de suporte:** confundir **dispatch de pedido** com **dispatch de notificação** (Message Dispatcher); prestador sem oportunidade pode estar fora do lote, sem beacon recente ou com dispatch **PAUSED**/**STOPPED**.

## 2. Ciclo de vida do dispatch (linguagem de produto)

| Status | Significado para negócio |
|--------|-------------------------|
| **PENDING / ACTIVE** | Pedido em distribuição progressiva; cron pode abrir novos lotes conforme `next_batch_at`. |
| **PAUSED** | Novos lotes **suspendidos** (ex.: cliente com muitas propostas pendentes); visibilidade já concedida permanece. |
| **STOPPED** | Distribuição **encerrada** (ex.: limite de propostas atingido); **nova proposta bloqueada**; chat ainda permitido se houver slot. |
| **FALLBACK_OPEN_MARKET** | Pool de candidatos esgotado em lotes; prestadores elegíveis podem ver o pedido no **mercado aberto** (badge *Mercado aberto* no card). |
| **MATCHED** | Cliente aceitou uma proposta; dispatch concluído. |
| **CANCELLED / EXPIRED** | Pedido cancelado ou janela de vida do dispatch esgotada; **mercado aberto lazy** deixa de aplicar após **EXPIRED**. |

## 3. Visibilidade no feed do prestador

| Origem (`source`) | Quando aparece |
|-------------------|----------------|
| **batch** | Prestador entrou em um **lote** aberto pelo cron; linha em `service_request_provider_visibility`. |
| **fallback** | Mercado aberto após esgotamento de lotes; elegibilidade por bairro + serviço ofertado. |

O app consome a Edge **`list-provider-opportunities`** → RPC `list_provider_opportunities` (cursor, sort, GPS opcional para distância).

**Descartar oportunidade:** RPC `dismiss_provider_opportunity` — remove do feed; não bloqueia `get_service` nem ações CNS.

## 4. Modelo duplo de localização

| Uso | Fonte | Plataforma |
|-----|--------|------------|
| **Elegibilidade em lote** (discovery/ranking) | `user_device_beacons` → `provider_latest_locations` | Android: `@capgo/background-geolocation`; Web/PWA: **somente em primeiro plano** |
| **Ordenação “Mais próximos” no feed** | GPS foreground (`useProviderLocation`) | Enviado como `lat`/`lng` na Edge; **sem coordenadas fabricadas** |

Prestador **sem GPS de feed** ainda vê oportunidades (sort padrão **Mais recentes**); aba **Mais próximos** fica oculta.

## 5. Notificações (MMD)

Ao abrir lote, trigger no banco ingere no Message Dispatcher template **`matching.new_opportunity`** (push + e-mail). Falha de push/e-mail **não** revoga visibilidade no feed.

## 6. Avaliações pós-serviço

RPCs `submit_service_rating` / `update_service_rating` e agregados em `provider_rating_stats` — integrados ao ranking de discovery (peso configurável em `matching.*`).

## 7. Documentação técnica e QA

| Recurso | Caminho |
|---------|---------|
| Design e tasks de implementação | `docs/matching-algorithm/` |
| Checklist staging geo → batch | `docs/matching-algorithm/qa/staging-geo-batch-checklist.md` |
| Checklist staging batch → MMD → feed | `docs/matching-algorithm/qa/staging-full-batch-path-checklist.md` |
| UI prestador (feed) | [provider-jobs](../provider-jobs/README.md) |

## 8. Artefatos principais (referência)

| Área | Caminhos |
|------|----------|
| Edge feed | `supabase/functions/list-provider-opportunities/` |
| Cron / lotes | `matching_open_batch`, `cron_process_service_request_dispatches` |
| Discovery | `matching_discover_candidates`, `provider_latest_locations` |
| Beacon | `user_device_beacons`, trigger `trg_user_device_beacon_refresh_provider_location` |
| Cliente geo | `src/features/device-beacon/` (`useProviderLocationTracking`, `DeviceBeaconProvider`) |
