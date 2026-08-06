# Beacon de dispositivo e localização operacional (`device-beacon`)

## 1. Leitura para negócio

- **Para que serve:** manter, por instalação do app, um **registro de dispositivo** com token de **push (FCM)** e, para **prestadores**, a **localização operacional** usada pelo matching progressivo (entrada em lotes / discovery). Também explica e solicita permissão de localização antes do prompt do sistema operacional.
- **Quem usa:** qualquer usuário autenticado (sync de beacon de push); **prestadores** (tracking de localização + diálogo de permissão). Clientes **não** enviam coordenadas operacionais.
- **Superfície de produto:** **sem rota própria**. Montado no `RootLayout` via `DeviceBeaconProvider`. O prestador vê um diálogo (“Localização para oportunidades”) quando ainda não respondeu ao explainer.
- **Valor:** push chega no aparelho certo; matching consegue priorizar prestadores **próximos** (raio de discovery **20 km** no backend).
- **Riscos de suporte:** prestador sem oportunidades por beacon **ausente**, **sem permissão**, **stale** (>24h) ou tracking pausado (`operational_status = suspended`); confundir **GPS do feed** (“Mais próximos”) com **beacon de lote** — são usos distintos (ver [matching-dispatch](../matching-dispatch/README.md) e [provider-jobs](../provider-jobs/README.md)).

## 2. Visão geral funcional

| Capacidade | Escopo | Resultado |
|------------|--------|-----------|
| Sync de beacon (push + metadados do device) | Usuário autenticado | Upsert em `user_device_beacons` (chave `profile_id` + `device_id`) |
| Tracking de localização operacional | Prestador ativo (não suspenso) | Atualiza `location*` no beacon → trigger → `provider_latest_locations` |
| Explainer + permissão OS | Prestador | Dialog + Preferences; eventos GA `location_permission_*` |
| Limpeza no logout | Qualquer perfil com sessão | Para tracking, deleta linha do device e limpa snapshot local |
| Purge no servidor | Cron diário | Remove beacons sem `updated_at` há **30 dias** |

**Honestidade de escopo:** o módulo é **infraestrutura de cliente** (providers React + API + utils). Não há telas de configuração, listagens nem Edge Functions próprias. Regras de **quando** o prestador entra em lote ficam em [matching-dispatch](../matching-dispatch/README.md).

## 3. Features do módulo

| Feature | Documento | Nota |
|---------|-----------|------|
| Rastreamento de dispositivo (beacon + geo operacional) | [features/rastreamento-dispositivo.md](./features/rastreamento-dispositivo.md) | Única feature documentada; cobre push sync, geo, permissão e logout |

## 4. Perfis envolvidos

| Papel | Comportamento evidenciado |
|-------|---------------------------|
| **Prestador** | Sync de push + localização se permissão concedida; dialog de explainer; tracking nativo (Android) ou só foreground (web); pausa se `operational_status === 'suspended'` |
| **Cliente** (e demais autenticados não-provider) | Sync de beacon **sem** campos de localização (`location_permission_granted: false`) |
| **Visitante** | Sem sync (exige `user` / `profileId`) |
| **Admin** | Sem fluxo dedicado neste módulo |

## 5. Principais fluxos

1. **Login / sessão ativa** → `DeviceBeaconProvider` coleta payload (device + FCM) e faz upsert se `shouldSyncDeviceBeacon`.
2. **Prestador** → `ProviderLocationProvider` inicia tracking + host do dialog de localização; amostras agendadas com debounce **60s**.
3. **Aceite de permissão** → grava Preferences, sync imediato, inicia tracking; **recusa** → sync com `location_permission_granted: false`.
4. **Logout** (`AuthProvider.signOut`) → `unregisterDeviceBeaconOnLogout` (stop + delete + limpa snapshot).
5. **Backend (fora deste módulo, efeito colateral)** → trigger `trg_user_device_beacon_refresh_provider_location` atualiza `provider_latest_locations` se houver beacon fresco (≤ **24h**).

## 6. Regras transversais

- **RLS:** usuário autenticado só gerencia linhas com `profile_id = auth.uid()` (`user_device_beacons_all`).
- **Modelo duplo de GPS:** beacon alimenta **elegibilidade de lote**; GPS de feed (`useProviderLocation` em provider-jobs) alimenta sort **Mais próximos** — ver matching-dispatch §4.
- **Sequência com push:** `appOpenOverlaySequence` faz o prompt de push (`push-permission`) esperar o fluxo de localização do prestador.
- **`initCapacitorPlugins`:** **não** inicia beacon/geo; só SystemBars, teclado, lifecycle e back button. Tracking começa nos providers React.

## 7. Entidades

| Entidade / artefato | Papel de negócio |
|---------------------|------------------|
| `user_device_beacons` | Registro por instalação: FCM, platform, permissão e última localização operacional |
| `provider_latest_locations` | Agregado denormalizado (1 linha/prestador) para discovery — mantido por trigger, **sem** acesso direto do cliente |
| Snapshot Preferences `orbit_device_beacon_last_sync_v1` | Evita upsert desnecessário (intervalo base **7 dias**, ou mudança de push/localização) |
| Preferences `orbit.location_prompt_seen` / `orbit.location_permission_granted` | Estado do explainer e cache de permissão |

## 8. Integrações

| Destino | Relação |
|---------|---------|
| [matching-dispatch](../matching-dispatch/README.md) | Consome `provider_latest_locations` / freshness / H3 / raio 20 km |
| [provider-jobs](../provider-jobs/README.md) | `useProviderLocation` lê amostras e status de permissão deste módulo |
| [auth](../auth/README.md) | Logout chama unregister; `useAuth` fornece role / `operational_status` |
| `push-permission` / `@/lib/push` | Token FCM no payload; sequência de prompts |
| Message Dispatcher | Lê `user_device_beacons` para fan-out de push; pode **desabilitar** beacon inválido (`message_dispatcher_disable_device_beacon`, service_role) — detalhe no módulo MMD |

## 9. Riscos e lacunas

| Risco / lacuna | Evidência / nota |
|----------------|------------------|
| Prestador sem beacon fresco some da discovery | `matching.beacon_location_max_age_hours` = 24 |
| Web/PWA só atualiza geo em **primeiro plano** | `providerLocationTracking.runtime.ts` |
| Path HTTP Capacitor (Android background) **não envia `h3_index`** | `deviceBeaconHttp.api.ts` vs `deviceBeacon.api.ts` — refresh no DB pode recalcular H3 a partir de `location` |
| Documentação transversal (mapa, matriz, índice de módulos) ainda pode listar o módulo só na rastreabilidade | Escopo deste entregável: pasta `modulos/device-beacon/` apenas |
| Ligação completa matching ↔ UI | Documentada em matching-dispatch / provider-jobs; este módulo só cobre o **lado cliente do beacon** |

## 10. Evidências

| Área | Paths |
|------|-------|
| Feature | `src/features/device-beacon/` (`index.ts`, `api/`, `components/`, `hooks/`, `utils/`, `types/`) |
| Montagem | `src/layouts/RootLayout.tsx` |
| Logout | `src/features/auth/AuthProvider.tsx` → `unregisterDeviceBeaconOnLogout` |
| Feed GPS | `src/features/provider-jobs/hooks/useProviderLocation.ts` |
| Schema / trigger | `supabase/migrations/20260520100000_create_user_device_beacons.sql`, `20260711020000_matching_beacon_location_columns.sql`, `20260711030000_matching_provider_latest_locations.sql` |
| Constantes matching | `supabase/migrations/20260711000000_matching_platform_constants_seeds.sql` |
| Rastreabilidade prévia | `docs/business/rastreabilidade.md` (hooks/utils de sync) |
