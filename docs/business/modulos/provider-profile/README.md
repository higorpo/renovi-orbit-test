# Perfil público do prestador (`provider-profile`)

## 1. Leitura para negócio

- **Para que serve:** **vitrine pública** do prestador para visitantes e clientes, com link compartilhável — inclui **reputação real** (média, contagem e comentários) quando houver avaliações.
- **Quem usa:** visitantes (URL pública); prestador indiretamente (conteúdo vem do cadastro; ratings vêm de clientes pós-conclusão).
- **Processo:** descoberta fora do fluxo logado padrão e reforço de marca pessoal.
- **Valor:** aquisição e confiança.
- **Riscos:** perfil `restricted` ou dados incompletos reduzem conversão — comunicar ao prestador na implantação.

## 2. Visão geral funcional

- **Objetivo:** página `/perfil/:slug` com SEO, serviços, portfólio, área, avaliações, CTA.
- **Escopo:** leitura via RPCs `get_public_provider_by_slug` e `list_public_provider_ratings` (+ dados públicos).
- **Limites:** não edita perfil (edição em `my-account`); não escreve rating (escrita em **service-completion**).
- **Relação:** depende de `provider_profiles_public`, `service_ratings` / `provider_rating_stats` e entidades associadas.

## 3. Features

| Feature | Documento |
|---------|-----------|
| Página pública | [features/pagina-publica.md](./features/pagina-publica.md) |

## 4. Perfis

- Público anônimo; prestador como autor do conteúdo; clientes avaliam em outro fluxo.

## 5. Fluxos

- Visitante abre link → vê perfil (com média/comentários se houver) → CTA para pedido ou contato conforme UI.

## 6. Regras transversais

- `profile_visibility`: `public` vs `restricted` (impacto de exibição — confirmar regras exatas na RPC/policies).
- Exibir `overall_avg` / lista só com avaliações reais; nunca `ranking_quality_score` na UI.

## 7. Entidades

- `provider_profiles_public`, `provider_portfolio_items`, `provider_offered_services`, `provider_service_area_neighborhoods`, `service_ratings`, `provider_rating_stats`.

## 8. Integrações

- RPC `get_public_provider_by_slug`; `list_public_provider_ratings` (cursor); imagens em storage público conforme política.
- `ProviderRatingStars` também usado no compare de orçamentos (`negotiation-proposals`).

## 9. Riscos

- **Evidência parcial:** matriz exata do que é omitido em modo `restricted` sem ler SQL completo da RPC.

## 10. Evidências

- `src/features/provider-profile/`
- `supabase/migrations/20260318100007_get_public_provider_by_slug.sql`
- pgTAP `supabase/tests/matching/provider_rating_read_rpcs_test.sql`

## 11. Atualização de auditoria (2026-08-02)

- Revalidado sem drift: `/perfil/:slug`, RPC `get_public_provider_by_slug`, edição fora deste módulo.

## 12. Atualização (2026-08-06)

- Ratings reais no header + seção de comentários com paginação por cursor; mocks de rating removidos das telas de exibição relacionadas.
