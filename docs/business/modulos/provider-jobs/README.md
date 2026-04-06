# Trabalhos do prestador (`provider-jobs`)

## 1. Leitura para negócio

- **Para que serve:** **descobrir pedidos** compatíveis com o prestador, **entender o detalhe**, **perguntar** ao cliente e **enviar proposta**.
- **Quem usa:** prestador.
- **Processo:** núcleo da oferta de serviço na plataforma (lado supply).
- **Valor:** gera receita potencial para o prestador e liquidez para o marketplace.
- **Riscos:** dependência de geolocalização, raio e serviços ofertados — suporte deve saber onde o prestador configura cada parte (`my-account`).

## 2. Visão geral funcional

- **Objetivo:** lista com infinite scroll, filtros, detalhe com abas, composer de proposta.
- **Escopo:** Edge `match-provider-jobs` + RPC `match_provider_jobs`; APIs de propostas e perguntas.
- **Limites:** não executa o serviço físico nem pagamento.
- **Relação:** `provider-budgets` (pós-envio), `client-budgets` / `client-my-services` (lado cliente).

## 3. Features

| Feature | Documento |
|---------|-----------|
| Trabalhos e propostas | [features/trabalhos-e-propostas.md](./features/trabalhos-e-propostas.md) |

## 4. Perfis

- Prestador; admin pode ter leituras no banco — sem UI aqui.

## 5. Fluxos

- Obter geo → listar jobs → abrir detalhe → (opcional) pergunta → enviar proposta com valores validados no servidor.

## 6. Regras transversais

- Proposta ativa única por par prestador+pedido exceto `withdrawn` (índice parcial único — migration).

## 7. Entidades

- `service_requests`, `provider_proposals`, `provider_service_request_questions`.

## 8. Integrações

- `supabase/functions/match-provider-jobs/index.ts`
- RPCs de criação de proposta com assinatura de preço.

## 9. Riscos

- Complexidade das regras SQL de matching — manter alinhamento com produto quando mudar.

## 10. Evidências

- `src/features/provider-jobs/`
- `supabase/migrations/20260318200001_match_provider_jobs_rpc.sql`
- `supabase/migrations/20260318200000_create_provider_proposals.sql`
