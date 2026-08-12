- Precisamos optar pelo regime de caixa para declaração de imposto de renda


Itens interessantes de ter na plataforma (futuro)

- Prestador poder adicionar um contato que ele já fez serviço para ser verificado na plataforma
- Forma de validar que o prestador é indicado para mulheres também
- Precisa permitir alterar valor combinado, adicionar itens extras, cliente aprova etc
- Usar IA pra ela criar novas perguntas baseado em tudo o que o cliente respondeu para que ele responda em caso de ter ficado alguma coisa em aberto, alguma coisa que o prestador teria que saber
- Colocar a IA pra sugerir fotos pra ele tirar que seriam interessantes pro prestador entender melhor o problema
- Poder denunciar pedidos de orçamento feitos na plataforma por infringir as regras
- Poder denunciar clientes
- Poder denunciar prestadores
- Criar mecanismo de descontos de taxas, onde a gente pode definir a % de desconto em cima da taxa original, título e descrição para o desconto e a data de início e fim que o desconto pode ser aplicado
- Usar IA para sugerir datas pro profissional na hora de montar o orçamento dele
- Usar IA para melhorar a descrição do orçamento do profissional
- Refatorar os uploads de imagens para ser mais compartilhado
- Verificar se é possível colocar caching de mutations para caso o usuário esteja sem internet isso ser enviado/sincronizado depois
- Quando enviar proposta ou entrar para ver detalhes de um pedido fora da área, perguntar ao prestador se ele quer adicionar aquela área
- Sistema de badges dos cards das telas de meus serviços e orçamentos para o cliente e prestador deveria ser unificado para manter consistência. Podemos unificar também o card de serviço para manter melhor consistência.
-mostrar contador de quantidade de chats não lidos no bottom navigator
- Adicionar integração com IA que avalia a melhor proposta e faz um resumo
- Exibir sugestões de perguntas para o prestador na hora que ele abre o chat pela primeira vez
-ver imagens que o chat gpt gerou da tela de detalhes do serviço e o que podemos incorporar de fato.
- Permitir se inscrever em um tópico no FCM
- Deixar página de erro mais bonita
- Adicionar no chat tanto do prestador  quanto do cliente ações rápidas para um serviço em estado de em andamento
  - Poder cancelar o serviço
  - Poder reagendar o serviço
  - Ver informações do serviço
- Prestador poder vender para clientes de fora da plataforma


Urgentes:

- Está dando erro para enviar imagens mesmo elas não tendo conteúdo errado na tela de criação  de pedido
- Renomear todas as rotas para ingles para manter consistência
- Tela de onboarding do prestador, onde ele selecione as áreas de atuação e os serviços que ele faz, além de outras opções (verificação do perfil)
- Há um problema com a captura de localização no formato atual. Ele está trazendo localização errada no PC, tem que checar se no Windows está assim também.
- Adicionar google analytics em todos os fluxos
- remoteconfig para não permitir cadastrar profissionais etc
- remoteconfig para redirecionar para grupo de whatsapp
- Adicionar no chat botão para envio de proposta que fica visível a todo momento
- Ver vídeo no Youtube sobre a questão que eu estou usando para precificação exibida para o prestador/cliente, pois parece que há um problema de segurança: https://www.youtube.com/watch?v=rTXy2p9aAVw&list=WL&index=75&t=601s&pp=iAQBsAgC.
- Como eu garanto que alterações feitas em tabelas/rpcs não quebram versões  anteriores do app?



Telas/fluxos restantes:

- Tela de perfil do prestador
- Sistema de disputas
- Tela de notificação
- Mesmo com cadastro manual precisa fazer aceite dos termos de uso
- Todo o painel administrativo
- Tela de onboarding para prestador
- Tela de onboarding para cliente
- Weblab
- Template dos emails
- Refazer tela de erros quando da crash no app
- Refazer tela de minha conta
- Como vai funcionar a emissão de nota fiscal da plataforma?
- Nova tela de minha conta
  - Criar telas exclusivas para "ganhos" e para os pagamentos recebidos e enviados do prestador e cliente, se atentando a todos os cenários possíveis de estado de um pagamento (pagamento efetuado, pagamento com reembolso parcial, pagamento com reembolso total etc..)
- Fluxo de antecipação de recebíveis 
- Está dando a opçaõ de verificar a conta com código ao invés do link no e-mail, mas no app não tem essa opção. Vamos alterar para só permitir via código, sem link... vai ficar melhor para o nosso fluxo!
- Coletar o máximo de métricas possíveis, tanto Google Analytics quanto Sentry


Coisas para verificar:

- Prestadores marcados como "Pioneiros" tem taxa de serviço menor
- Direcionar prestador para que ele cadastre serviços que ele atenda para exibir trabalhos
- Verificar como estamos fazendo upload de arquivos hoje na plataforma. Precisamos usar pre-signed urls e não passar nada pelo servidor/EFs. Também precisamos eliminar arquivos órfãos.
- Verificar se devemos usar ULID a o invés de UUID
- Avaliação de onboarding de prestadores por parte da plataforma, depois que a netcred aprova nós precisamos aprovar também.




Coisas para fazer next
-fluxo de prestador recusar revisão de proposta

- Verificar se todos os locais onde tenho carregando de mais páginas no sistema estão usando cursor de forma performática.




- na tela de minha conta do cliente, precisa colocar skeleton para as informações relacionadas a pagamentos







- Fluxo de estorno de dinheiro em caso do serviço agendado não ser  prestado para o cliente.











- Informação "Previsão de depósito na conta" está incorreta na tela de detalhes do serviço (quando tem parcelamento ou algo do tipo). Ao invés disso, redirecionar para tela de Ganhos com filtro específico apenas para os ganhos relacionados aquele serviço.




- Permitir editar informações do pedido quando  ele ainda está buscando por propostas.

- Chat não está mostrando avatar do prestador mesmo quando ele tem imagem. Verificar todos os outros lugares que possuem avatares se eles estão carregando a informação corretamente.



- Permitir cadastrar empresas, usar nome da empresa ao inves do nome do responsável
- Alterar upload de foto de perfil na tela de configurações para usar capacitor e permitir fazer upload direto da camera do celular

- Adicionar página nas configurações para o prestador ver as informações fornecidas no onboarding (documentos)




---




Detalhes dos testes:
Cartão aprovado: 4970100000000048
Cartão rejeitado: 4970100000000071

10/2027
123
Maria da Silva
504.432.630-51

CPF/CNPJ terminando em 1 → aprovação
CPF/CNPJ terminando em outro dígito → rejeição




----
