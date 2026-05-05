import { NavLink } from 'react-router-dom'
import { Boxes, Truck, ClipboardList } from 'lucide-react'

const ITEMS = [
  { to: '/mobile/stock', label: 'Stock', Icon: Boxes },
  { to: '/mobile/order', label: 'Pesan', Icon: ClipboardList },
  { to: '/mobile/delivery', label: 'Delivery', Icon: Truck },
]

export default function MobileBottomNav() {
  return (
    <nav className="border-t border-slate-200 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        {ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
              }`
            }
          >
            <Icon className="mb-1 h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
