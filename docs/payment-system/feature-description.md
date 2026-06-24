# VISÃO GERAL DA RENOVI

A Renovi é um marketplace que conecta clientes e prestadores de serviços.

Fluxo simplificado:

1. Cliente publica uma necessidade.
2. Prestadores enviam propostas.
3. Cliente aceita uma proposta.
4. Serviço é agendado para uma data futura.
5. Cliente realiza o pagamento.
6. Prestador executa o serviço.
7. Prestador recebe o valor posteriormente.

---

# REQUISITO ARQUITETURAL PRINCIPAL

O sistema de pagamentos deve ser totalmente agnóstico de provedor.

Não podemos acoplar regras de negócio diretamente à NetCred.

Devemos criar uma camada de abstração para provedores de pagamento.

Exemplo:

PaymentProvider Interface

* tokenizeCard()
* createCharge()
* cancelCharge()
* refundCharge()
* getTransaction()
* processWebhook()

No futuro devemos conseguir substituir a NetCred por outro provedor sem alterar regras de negócio.

Exemplos futuros:

* NetCred
* Pagar.me
* Asaas
* Stripe
* Mercado Pago
* Adyen

O sistema deve seguir o padrão:

Application Layer
→ Payment Abstraction Layer
→ Provider Adapter
→ Gateway Externo

---

# PROVEDOR INICIAL

Inicialmente utilizaremos exclusivamente a NetCred.

Forma de pagamento inicial:

* Cartão de Crédito

No futuro:

* Pix
* Boleto

A arquitetura já deve nascer preparada para esses meios de pagamento futuros.

---

# CREDENCIAMENTO DOS PRESTADORES

Antes de receber pagamentos, o prestador precisa ser credenciado junto à NetCred.

O credenciamento envolve:

* Fluxos internos da Renovi
* Processos de KYC
* Envio de informações para a NetCred
* Comunicação por e-mail com a NetCred
* Aprovação do prestador

Somente após o credenciamento aprovado:

status = ACTIVE

o prestador poderá executar serviços pagos.

Criar todos os estados possíveis do credenciamento.

Exemplo:

PENDING_DOCUMENTS
UNDER_REVIEW
WAITING_NETCRED
APPROVED
REJECTED
SUSPENDED

Detalhar o fluxo completo.

---

# CADASTRO DE CARTÃO

Quando um orçamento for aceito:

Caso o cliente ainda não possua cartão cadastrado:

Solicitar:

* Nome
* CPF
* Telefone
* Dados do cartão

O frontend nunca deve armazenar dados sensíveis.

Utilizar tokenização.

Fluxo:

Frontend
→ Edge Function Renovi
→ API NetCred
→ Token retornado
→ Salvar apenas token

Jamais armazenar:

* Número do cartão
* CVV
* Dados sensíveis

Somente:

* Token
* Número do cartão mascarado
* Bandeira
* Data de expiração mascarada

---

# ACEITE DO SERVIÇO

Após tokenização bem sucedida:

1. Cliente confirma contratação.
2. Serviço entra em estado confirmado.
3. Sistema agenda cobrança futura.

---

# REGRA DE COBRANÇA

A cobrança NÃO acontece imediatamente.

A cobrança acontece exatamente:

48 horas antes da data agendada do serviço.

Exemplo:

Serviço:
20/08 no turno da tarde

Cobrança:
18/08 às 13:00

---

# AGENDAMENTO DA COBRANÇA

Criar arquitetura utilizando:

Cron Jobs
ou
Scheduled Jobs

Cada cobrança futura deve ser registrada.

Exemplo:

payment_schedule

id
service_id
execution_at
status
attempts

Estados:

SCHEDULED
PROCESSING
PAID
FAILED
CANCELLED

---

# CANCELAMENTO ANTES DA COBRANÇA

Se o serviço for cancelado antes da execução da cobrança:

Remover ou invalidar o agendamento.

O sistema jamais deve tentar cobrar um serviço cancelado.

Criar todas as validações necessárias.

---

# PROCESSAMENTO DA COBRANÇA

Quando chegar o momento programado:

1. Buscar cobrança agendada.
2. Validar estado do serviço.
3. Validar estado do cliente.
4. Validar token do cartão.
5. Executar cobrança na NetCred.
6. Registrar logs.
7. Registrar auditoria.
8. Atualizar status.

Tudo deve ser idempotente.

---

# RETRY AUTOMÁTICO

Caso a cobrança falhe:

Implementar retry automático.

Sugestão:

Tentativa 1:
48 horas antes

Tentativa 2:
24 horas depois

Tentativa 3:
12 horas antes do serviço

Após isso:

FAILED_PERMANENT

Mas você deve avaliar e sugerir a melhor estratégia.

---

# COMUNICAÇÃO DE FALHAS

Sempre que houver falha:

Notificar:

* Cliente
* Prestador

Canais:

* Push
* E-mail

Mensagens claras e amigáveis.

Informar:

* Motivo da falha
* O que fazer
* Prazo para correção

---

# PAGAMENTO MANUAL

Após falhas automáticas:

Cliente poderá tentar novamente manualmente.

Fluxo:

Área do serviço
→ Botão "Realizar Pagamento"

Nova tentativa de cobrança.

Utilizando o token existente.

Ou cadastrando novo cartão.

---

# REGRA DE CANCELAMENTO POR FALTA DE PAGAMENTO

Se faltarem menos de 12 horas para o serviço e o pagamento continuar pendente:

Cancelar automaticamente o serviço.

Fluxo:

Status atual:
PAYMENT_PENDING

Transição:

SERVICE_CANCELLED_NON_PAYMENT

Notificar:

Cliente
Prestador

Via:

Push
E-mail

Explicar claramente o motivo.

---

# WEBHOOKS

Utilizar webhooks da NetCred.

Criar arquitetura completa de processamento.

Requisitos:

* Assinatura/verificação
* Idempotência
* Retry
* Dead Letter Queue
* Logs
* Auditoria

Eventos possíveis:

PAYMENT_APPROVED
PAYMENT_DENIED
PAYMENT_CANCELLED
PAYMENT_REFUNDED
SETTLEMENT_COMPLETED

Criar arquitetura preparada para novos eventos.

---

# IDMPOTÊNCIA

Todo o sistema deve ser idempotente.

Detalhar:

* Cobranças
* Webhooks
* Agendamentos
* Cancelamentos
* Reprocessamentos

Criar chaves de idempotência.

Mostrar exemplos.

---

# RESILIÊNCIA

Projetar para suportar:

* Timeout da NetCred
* Queda da NetCred
* Falha de rede
* Falha de banco
* Webhook duplicado
* Cron executando duas vezes
* Eventos fora de ordem

Explicar como resolver cada cenário.

---

# OBSERVABILIDADE

Definir:

Logs estruturados

Métricas:

* Taxa de aprovação
* Taxa de falha
* Tempo médio de cobrança
* Tempo médio de resposta da NetCred

Alertas:

* Falha de webhook
* Falha de cron
* Alta taxa de erro
* Cobranças pendentes

Tracing distribuído.

---

# SEGURANÇA

Considerar:

PCI Compliance
LGPD
Criptografia
Secrets Management
Rate Limiting
Proteção contra fraude
Proteção contra replay attack
Proteção contra brute force

Detalhar todos os controles.

---

# MODELAGEM DE DADOS

Criar tabelas completas para:

payment_providers
payment_methods
payment_tokens
payment_transactions
payment_schedules
payment_attempts
payment_webhooks
payment_events
provider_accounts
provider_credentials
audit_logs

Definir:

* Campos
* Tipos
* Índices
* Constraints
* Relacionamentos

---

# MÁQUINAS DE ESTADO

Criar state machines completas para:

Serviço
Pagamento
Cobrança
Credenciamento
Webhook

Mostrar diagramas Mermaid.

---

# EVENT DRIVEN

Propor arquitetura baseada em eventos.

Eventos sugeridos:

ServiceAccepted
CardTokenized
ChargeScheduled
ChargeStarted
ChargeSucceeded
ChargeFailed
PaymentCancelled
ServiceCancelled
ProviderWebhookReceived

Explicar quais eventos devem existir.
---

# ROADMAP FUTURO

Projetar arquitetura já preparada para:

Pix
Boleto
Split de pagamento
Antecipação de recebíveis
Estorno
Chargeback
Carteira digital
Múltiplos gateways

Sem necessidade de reescrever regras de negócio.