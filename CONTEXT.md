# Orbit — glossário de domínio (CONTEXT)

Termos canônicos acordados em sessões de design. Sem detalhes de implementação.

## Meus Serviços (prestador)

Pipeline de **acompanhamento** de pedidos em que o prestador **já participa** (proposta enviada e/ou contrato). Não inclui descoberta de novas oportunidades — isso é **Trabalhos**.

No **card da lista**: exibir **nome mascarado da cliente**; badge principal = **fase do pedido**; sinal secundário = **status contextual da proposta** (ex.: "Aguardando cliente", "Revisão solicitada"). Ação primária: **Ver conversa** (desabilitada com tooltip se não houver chat); secundária: Ver detalhes.

Deep link `?serviceRequestId=` — **somente cliente**.

Ordenação da lista: por **última atividade** (proposta/chat/pedido), não só data de criação do pedido.

Fases visíveis na lista:

- **Em negociação** — chat aberto e/ou proposta enviada aguardando decisão do cliente
- **Em andamento** — proposta aceita, serviço contratado em execução
- **Concluídos** — serviço finalizado
- **Cancelados** — pedido cancelado (hoje apenas o **cliente** pode cancelar o pedido; cancelamento pelo prestador é futuro)

**Disputas** — conceito previsto, **não implementado** ainda. A aba permanece visível na UI (lista vazia) até a feature existir.

## Meus Serviços (cliente)

Lista de **pedidos** que o cliente solicitou na plataforma (`service_requests`). Não confundir com serviços ofertados pelo prestador no catálogo.

## Nomenclatura de menu

Tanto **cliente** quanto **prestador** usam o label **"Meus Serviços"** no menu, apontando para `/dashboard/services`. O conteúdo da página varia por papel (slot por role).

## Trabalhos

Descoberta de oportunidades abertas compatíveis com o perfil do prestador. Pedidos em que o prestador **já enviou proposta** saem de Trabalhos e passam a aparecer em Meus Serviços (prestador).
