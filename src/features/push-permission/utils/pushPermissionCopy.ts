import type { ProfileRole } from '@/features/auth'

export interface PushPermissionCopy {
  benefits: string
}

const CLIENT_COPY: PushPermissionCopy = {
  benefits:
    'Queremos avisar você na hora quando algo importante acontecer no Prestway — por exemplo, quando chegar um novo orçamento, uma resposta do profissional ou uma atualização no seu pedido.',
}

const PROVIDER_COPY: PushPermissionCopy = {
  benefits:
    'Queremos avisar você na hora quando surgir uma oportunidade no Prestway — por exemplo, um novo pedido na sua área, uma resposta à sua proposta ou uma atualização em um serviço em andamento.',
}

const DEFAULT_COPY: PushPermissionCopy = {
  benefits:
    'Queremos avisar você na hora quando algo importante acontecer no Prestway — atualizações de pedidos, orçamentos e mensagens relacionadas à sua conta.',
}

export function getPushPermissionCopy(role: ProfileRole | null | undefined): PushPermissionCopy {
  if (role === 'client') return CLIENT_COPY
  if (role === 'provider') return PROVIDER_COPY
  return DEFAULT_COPY
}
