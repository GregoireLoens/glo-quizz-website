import { Avatar } from './Avatar'

interface Props {
  name: string
  userId?: number | null
  subtitle: string
  ready?: boolean
  pending?: boolean
}

export function PlayerBubble({ name, userId = null, subtitle, ready = false, pending = false }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar
        name={name}
        userId={userId}
        size={76}
        ring={ready ? 'citron' : pending ? 'dashed' : 'none'}
        variant={pending ? 'neutral' : 'color'}
        dim={pending}
      />
      <span className="text-[13px] font-semibold text-cream">{name}</span>
      <span className="text-[11px] text-muted">{subtitle}</span>
    </div>
  )
}
