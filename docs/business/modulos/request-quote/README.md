# Pedir orçamento (`request-quote`)

## 1. Leitura para negócio

- **Para que serve:** canal principal de **entrada de pedidos** na plataforma — visitante ou cliente monta o pedido (serviço, detalhes estruturados, descrição com IA opcional, fotos, endereço, identidade se necessário) e o backend cria **`service_requests`** prontos para matching e orçamentos.
- **Quem usa:** visitantes e clientes; não é fluxo do prestador.
- **Valor:** padroniza dados do pedido (formulário versionado + opcionalmente metadados de IA) e geolocalização via endereço.
- **Riscos:** abuso (rate limit + reCAPTCHA); **redirect pós-pedido logado** pode quebrar UX; **limite de tamanho de foto** diverge entre cliente (10 MB) e servidor (5 MB).

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rota pública | `/pedir-orcamento`; query opcional `?serviceSlug=` |
| Passos | 5 (convidado) ou 4 (logado — sem passo “Cadastro”) |
| Criação do pedido | POST multipart para Edge **`create-request-quote-order`** (`verify_jwt = false`; validação interna) |
| IA | Edge **`generate-smart-description`** (`verify_jwt = true`), disparo automático ao entrar no passo 3 vindo do passo 2 |
| Rascunho | `localStorage` com versão; sem PII do passo 5; debounce 400 ms |
| Antes do POST | reCAPTCHA ação `request_quote_submit`; opcionalmente **nsfwjs** nas fotos |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/pedir-orcamento.md](./features/pedir-orcamento.md) | Passos, validações, IA, rascunho, multipart, Edge, analytics, lacunas (redirect, fotos), evidências |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Página | `components/RequestQuote/RequestQuote.tsx` |
| Passos | `Step1ServiceSelect.tsx`, `Step2ServiceForm.tsx`, `Step3DescriptionPhotos.tsx`, `Step5Identity.tsx` |
| Pós-envio convidado | `components/ConfirmEmailScreen/ConfirmEmailScreen.tsx` |
| Trust / social proof | `components/TrustSidebar.tsx` |
| Estado e fluxo | `hooks/useRequestQuoteState.ts`, `useRequestQuoteNavigation.ts`, `useRequestQuoteSubmit.ts`, `useRequestQuoteDraft.ts`, `useRequestQuoteServices.ts`, `useServiceSchema.ts`, `useGenerateSmartDescription.ts` |
| API | `api/createRequestQuoteOrder.api.ts`, `smartDescription.api.ts`, `services.api.ts`, `forms.api.ts`, `serviceRequests.api.ts` |
| Rascunho / fotos / IA | `utils/requestQuoteDraft.persistence.ts`, `requestQuoteDraftMeaningful.ts`, `photoContentCheck.ts`, `step3SmartDescriptionSnapshot.ts`, `stableStringify.ts`, `serviceSchemaFallbackMessages.ts`, `serviceCardStyle.ts` |
| Tipos | `types/request-quote.types.ts` |

## 5. Integrações

- **`dynamic-form`** — motor do passo 2.
- **`addresses`** — passo 4 (`AddressSelectionStep`, `addressFormSchema`).
- **`auth`** — sessão, signup inline, política de senha, redirect de e-mail.
- **Supabase Functions:** `create-request-quote-order`, `generate-smart-description`; reCAPTCHA validado na Edge de pedido (e função dedicada `verify-recaptcha` no ecossistema).
- **Storage:** bucket `service-requests` (upload na Edge).

## 6. Edge Functions (referência)

- `supabase/functions/create-request-quote-order/` — ordem completa: rate limit, multipart, reCAPTCHA, usuário, endereço, fotos, insert `service_requests` com `status: "open"`.
- `supabase/functions/generate-smart-description/` — corpo JSON; usada via `supabase.functions.invoke` no app.

## 7. API pública do pacote (`index.ts`)

Exporta o componente `RequestQuote`, hooks/tipos utilitários para outros módulos (ex.: `getServiceCardStyle`, `listServicesForRequestQuote`, `useServiceRequestPhotoUrls`) e chamadas de IA/API quando reexportadas — ver arquivo para lista exata.

## 8. Pendência de produto cruzada

- Redirecionamento após pedido logado: ver **[P-01](../../pendencias-e-incertezas.md)** e seção de lacunas em [pedir-orcamento.md](./features/pedir-orcamento.md).
