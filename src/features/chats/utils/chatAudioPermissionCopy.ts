export interface ChatAudioPermissionCopy {
  title: string;
  benefits: string;
  nextStep: string;
  blockedTitle: string;
  blockedBody: string;
  webSettingsHint: string;
}

export const CHAT_AUDIO_PERMISSION_COPY: ChatAudioPermissionCopy = {
  title: "Permitir microfone",
  benefits:
    "Para enviar mensagens de áudio no chat, a Prestway precisa acessar o microfone do seu aparelho.",
  nextStep:
    "Na próxima etapa, o sistema do seu aparelho vai pedir permissão para usar o microfone. Você pode mudar isso depois nas configurações.",
  blockedTitle: "Microfone bloqueado",
  blockedBody:
    "Não foi possível usar o microfone. Habilite a permissão de microfone nas configurações do dispositivo para gravar áudios.",
  webSettingsHint:
    "No navegador, abra as configurações do site (ícone de cadeado ou informações na barra de endereço) e permita o acesso ao microfone.",
};
