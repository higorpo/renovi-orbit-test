import { useOverlayOpenChange } from '@/lib/overlayHistory'

type OverlayRootProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function useOverlayRootProps<P extends OverlayRootProps>(
  props: P
): P {
  const onOpenChange = useOverlayOpenChange(props.open, props.onOpenChange)
  return { ...props, onOpenChange }
}
