import { Link } from 'react-router-dom'

import { Icon, type IconName } from './Icon'

export interface BottomNavItem {
  label: string
  icon: IconName
  to: string
  raised?: boolean
}

/** Nav basse mobile, 5 entrées, cibles ≥44px — sous 768px, les liens desktop (hidden md:flex)
 * n'avaient aucun remplacement : Multijoueur, Classement, Mes quiz étaient inatteignables.
 * Position fixe : le body réserve l'espace correspondant sous md (voir index.css). */
export function BottomNav({ items, active }: { items: BottomNavItem[]; active: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-end justify-around gap-0.5 border-t border-line bg-ink px-2 pb-[10px] md:hidden">
      {items.map((item) => {
        const on = item.label === active
        if (item.raised) {
          return (
            <Link key={item.label} to={item.to} className="-mt-[26px] flex min-w-11 flex-col items-center gap-1.5">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-4 border-ink bg-citron text-ink">
                <Icon name={item.icon} size={22} />
              </span>
              <span className="text-[11px] font-semibold text-cream-soft">{item.label}</span>
            </Link>
          )
        }
        return (
          <Link
            key={item.label}
            to={item.to}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5 px-1.5 ${
              on ? 'text-citron' : 'text-muted-soft'
            }`}
          >
            <Icon name={item.icon} size={22} />
            <span className={`text-[11px] ${on ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
