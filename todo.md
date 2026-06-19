home services app that lists local vendors app

Itens interessantes de ter na plataforma (futuro)

- Prestador poder adicionar um contato que ele já fez serviço para ser verificado na plataforma
- Forma de validar que o prestador é indicado para mulheres também
- Precisa permitir alterar valor combinado, adicionar itens extras, cliente aprova etc
- Usar IA pra ela criar novas perguntas baseado em tudo o que o cliente respondeu para que ele responda em caso de ter ficado alguma coisa em aberto, alguma coisa que o prestador teria que saber
- Colocar a IA pra sugerir fotos pra ele tirar que seriam interessantes pro prestador entender melhor o problema
- Poder denunciar perguntas feitas em trabalhos por infringir as regras da plataforma
- Poder denunciar pedidos de orçamento feitos na plataforma por infringir as regras
- Criar mecanismo de descontos de taxas, onde a gente pode definir a % de desconto em cima da taxa original, título e descrição para o desconto e a data de início e fim que o desconto pode ser aplicado
- Usar IA para sugerir datas pro profissional na hora de montar o orçamento dele
- Usar IA para melhorar a descrição do orçamento do profissional
- Refatorar os uploads de imagens para ser mais compartilhado
- Ajustar algoritmo de matching para ter pesos em relação a várias variáveis para calcular quais serviços seriam mais interessantes de mostrar primeiro.
- Verificar se é possível colocar caching de mutations para caso o usuário esteja sem internet isso ser enviado/sincronizado depois
- Quando enviar proposta ou entrar para ver detalhes de um pedido fora da área, perguntar ao prestador se ele quer adicionar aquela área
- Prestador de serviços ter um calendário de serviços que ele pode gerenciar na plataforma, integrado com as datas que ele passa na hora de fazer o orçamento
- Sistema de badges dos cards das telas de meus serviços e orçamentos para o cliente e prestador deveria ser unificado para manter consistência. Podemos unificar também o card de serviço para manter melhor consistência.
- Na tela de detalhes do chat, incluir botão para redirecionar usuário para tela de detalhes do pedido/serviço
- Criar tela exclusiva de detalhes do pedido/serviço que pode ser acessível via link. Tela de detalhes do pedido deve ser acessível para qualquer usuário logado e poderia permitir enviar propostas diretamente pelo link
-mostrar contador de quantidade de chats não lidos no bottom navigator
- Adicionar integração com IA que avalia a melhor proposta e faz um resumo
- Exibir sugestões de perguntas para o prestador na hora que ele abre o chat pela primeira vez



Urgentes:

- Está dando erro para enviar imagens mesmo elas não tendo conteúdo errado na tela de criação  de pedido
- Renomear todas as rotas para português para manter consistência
- Tela de onboarding do prestador, onde ele selecione as áreas de atuação e os serviços que ele faz, além de outras opções (verificação do perfil)
- Há um problema com a captura de localização no formato atual. Ele está trazendo localização errada no PC, tem que checar se no Windows está assim também.
- Adicionar google analytics em todos os fluxos
- Sistema de verificação de perfil do prestador, onde ele anexa os documentos e a equipe interna avalia
- remoteconfig para não permitir cadastrar profissionais etc
- remoteconfig para redirecionar para grupo de whatsapp
-cadastro e criação de service requests não estão funcionando por conta da proteção 

Telas/fluxos restantes:

- Pagamento de um serviço
- Visualização de detalhes de um serviço em execução
- Visualizar checklist de conclusão do serviço
- Avaliação do serviço após sua conclusão
- Tela de perfil do prestador
- Calendário do prestador
- Prestador poder vender para clientes de fora da plataforma
- Sistema de disputas
- Tela de notificação
- Mesmo com cadastro manual precisa fazer aceite dos termos de uso
- Todo o painel administrativo
- Tela de onboarding para prestador
- Tela de onboarding para cliente
- Fluxo do prestador/cliente remarcar um serviço
- Fluxo do prestador/cliente cancelar um serviço
- Weblab
- Emails

Coisas para verificar:

- Não deve mostrar trabalho que eu enviei proposta na tela de trabalhos
- Prestadores marcados como "Pioneiros" tem taxa de serviço menor
- Direcionar prestador para que ele cadastre serviços que ele atenda para exibir trabalhos
- Estrelas de avaliação dos cards devem estar usando dados reais


Coisas para terminar do fluxo atual de trabalho:

- ao gerar a descrição do pedido, também gerar o checklist de conclusão do serviço
  - mostrar o checklist de conclusão do serviço pro prestador na hora que ele vai fazer o orçamento e permitir que ele altere alguma coisa
  - apresentar o checklist de conclusão do serviço para o cliente quando ele vai fechar o serviço


Coisas para fazer next
-renomear tabela de provider_proposals
-[avaliar]simplificar query de get_service_list  (hoje ele tá trazendo um monte de dados que nem vai ser exibido no card)
-fluxo de prestador recusar revisão de proposta
-no mobile estilizar menu do topo para ter botão de voltar e etc e abrir como se fosse uma nova activity



-ver imagens que o chat gpt gerou da tela de detalhes do serviço e o que podemos incorporar de fato.
-está aparecendo action banner de enviar proposta quando não deveria.
-problema no message dispatcher  que quando ele recebe uma notificação que precisa ser enviada naquele momento, ele tenta agendar para outro momento se já esta cheio
-nas notificações de nova oportunidade, qunado clicar quero que abra a página de detalhes do serviço direto
- não exibir quantidade de conversas ativas no card
- reformular card
- na tela de trabalhos está mostrando trabalhos dos quais eu já tenho chat ativo
- se o prestador tirar um serviço que ele presta ele continua vendo aquele serviço no feed?
-se eu tenho várias push scheduled,qnd elas viram queued elas são enviadas tudo ao mesmo tempo e não respeitam os limites