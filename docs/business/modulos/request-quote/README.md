# Pedir orçamento (`request-quote`)

## 1. Leitura para negócio

- **Para que serve:** permitir que cliente ou visitante **inicie um pedido** selecionando serviço, respondendo formulário dinâmico, descrevendo a necessidade (com apoio de IA opcional), informando endereço e identidade (incluindo **cadastro inline** quando necessário).
- **Quem usa:** visitantes e clientes logados.
- **Processo:** topo do funil de demanda da plataforma.
- **Valor:** gera `service_requests` alimentando o matching.
- **Riscos:** abuso (mitigado por reCAPTCHA e rate limit); **redirect pós-sucesso possivelmente incorreto** — ver pendências.

## 2. Visão geral funcional

- **Objetivo:** wizard multi-step até POST na Edge Function `create-request-quote-order`.
- **Escopo:** serviços, formulário, fotos, validação de conteúdo de foto no cliente, draft local.
- **Limites:** não exibe orçamentos recebidos (outros módulos).
- **Relação:** `dynamic-form`, `addresses`, `auth`, Edge Functions, storage.

## 3. Features

| Feature | Documento |
|---------|-----------|
| Pedir orçamento | [features/pedir-orcamento.md](./features/pedir-orcamento.md) |

## 4. Perfis

- Público: fluxo completo com criação de usuário no final quando aplicável.
- Logado: envio direto amarrado ao `user.id`.

## 5. Fluxos

- Seleção serviço → formulário → descrição/fotos → endereço → identidade/confirmação → sucesso.

## 6. Regras transversais

- Versão de formulário e schema enviados ao servidor para consistência.
- Fotos: checagem heurística no cliente antes do envio (`photoContentCheck`).

## 7. Entidades

- `service_requests`, `client_addresses`, `platform_services`, `platform_forms`, uso de IA logs.

## 8. Integrações

- `create-request-quote-order`, `generate-smart-description`, `verify-recaptcha`, OpenAI/Gemini.

## 9. Riscos

- Função com `verify_jwt = false`: segurança delegada a validações internas e rate limit — revisar runbooks de segurança.

## 10. Evidências

- `src/features/request-quote/`
- `supabase/functions/create-request-quote-order/`
- `supabase/functions/generate-smart-description/`
- `src/router.tsx` (`/pedir-orcamento`)
