# Minha conta (`my-account`)

## 1. Leitura para negócio

- **Para que serve:** ponto único de **configurações de conta** para cliente e prestador, com ramificações por papel.
- **Quem usa:** cliente e prestador autenticados.
- **Processo:** manter dados cadastrais, preferências, e no prestador **perfil público**, **serviços ofertados**, **área de atuação**, **portfólio** e dados legais.
- **Valor:** qualidade do matching e confiança na contratação.
- **Riscos:** exclusão de conta e dados sensíveis (CPF/CNPJ) exigem processo de atendimento alinhado à LGPD.

## 2. Visão geral funcional

- **Objetivo:** `MyAccountPage` delega para `MyAccountClientPage` ou `MyAccountProviderPage`.
- **Escopo:** CRUD sobre perfis privados/públicos, storage de imagens, listas relacionadas.
- **Limites:** não é CRM nem backoffice admin.
- **Relação:** `addresses` (cliente), catálogo de serviços da plataforma (prestador).

## 3. Features

| Feature | Documento |
|---------|-----------|
| Minha conta | [features/minha-conta.md](./features/minha-conta.md) |

## 4. Perfis

- Cliente: dados pessoais, endereços, privacidade.
- Prestador: acima + identidade legal, perfil público, portfólio, área, serviços ofertados.

## 5. Fluxos

- Entrada pelo menu “Minha conta” → seções tabuladas → salvar → feedback UI.

## 6. Regras transversais

- Operações condicionadas a RLS e a papel `provider` para tabelas específicas.

## 7. Entidades

- `client_profiles_private`, `provider_profiles_private`, `provider_profiles_public`, `provider_offered_services`, `provider_portfolio_items`, `provider_service_area_neighborhoods`, storage de imagens.

## 8. Integrações

- Upload em buckets `profile-images`, `provider-portfolio-images`.

## 9. Riscos

- Campos legais incorretos podem bloquear conformidade em auditorias externas.

## 10. Evidências

- `src/features/my-account/`
- Migrações `20260318100000_*` a `20260318100010_*` (perfil cliente/prestador, sync triggers)
