import { NavLink, Outlet } from 'react-router-dom'
import {
  PosSettingsOutletProvider,
  usePosSettingsOutlet,
} from '../contexts/PosSettingsOutletContext'
import { useState } from 'react'
import {
  ChevronDown,
  Home,
  Monitor,
  MoreHorizontal,
} from 'lucide-react'

const navLinkInactive =
  'block rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
const navLinkActive =
  'block rounded-lg bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'

function AccordionSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-slate-400"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {title === 'Utama' && <Home className="h-3.5 w-3.5" aria-hidden />}
          {title === 'Perangkat' && (
            <Monitor className="h-3.5 w-3.5" aria-hidden />
          )}
          {title === 'Lainnya' && (
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          )}
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="pb-2 pl-2 pr-1">{children}</div> : null}
    </div>
  )
}

const itemsUtama = [
  { path: '/pos/pengaturan/kasir', label: 'Kasir', end: true },
  {
    path: '/pos/pengaturan/struk-biaya',
    label: 'Struk & Biaya',
    end: true,
  },
  {
    path: '/pos/pengaturan/pembayaran-non-tunai',
    label: 'Pembayaran Non Tunai',
    end: true,
  },
  { path: '/pos/pengaturan/pajak', label: 'Pajak', end: true },
]

const itemsPerangkat = [
  { path: '/pos/pengaturan/printer', label: 'Printer', end: true },
]

const itemsLainnya = [
  { path: '/pos/pengaturan/web-order', label: 'Web Order', end: true },
  { path: '/pos/pengaturan/ganti-pin', label: 'Ganti PIN', end: true },
  { path: '/pos/pengaturan/reset-pin', label: 'Reset PIN', end: true },
]

function PosPengaturanInner() {
  const { warehouses, settingsWarehouseId, setSettingsWarehouseId } =
    usePosSettingsOutlet()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f7fa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Pengaturan outlet
        </span>
        <select
          value={settingsWarehouseId}
          onChange={(e) => setSettingsWarehouseId(e.target.value)}
          className="max-w-[16rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium outline-none ring-blue-400/60 focus:border-blue-400 focus:ring-1 dark:border-slate-600 dark:bg-slate-950"
        >
          {(warehouses || []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <span className="hidden text-[13px] text-slate-500 md:inline">
          Setelan disimpan ke Firestore per gudang.
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar Pengaturan */}
      <aside className="flex w-[15.5rem] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-5 dark:border-slate-800">
          <h1 className="text-xl font-bold tracking-tight">Pengaturan</h1>
        </div>

        <nav className="flex-1 py-3" aria-label="Menu pengaturan POS">
          <AccordionSection title="Utama">
            {itemsUtama.map(({ path, label, end }) => (
              <NavLink
                key={path}
                to={path}
                end={Boolean(end)}
                className={({ isActive }) => (isActive ? navLinkActive : navLinkInactive)}
              >
                {label}
              </NavLink>
            ))}
          </AccordionSection>
          <AccordionSection title="Perangkat">
            {itemsPerangkat.map(({ path, label, end }) => (
              <NavLink
                key={path}
                to={path}
                end={Boolean(end)}
                className={({ isActive }) => (isActive ? navLinkActive : navLinkInactive)}
              >
                {label}
              </NavLink>
            ))}
          </AccordionSection>
          <AccordionSection title="Lainnya">
            {itemsLainnya.map(({ path, label, end }) => (
              <NavLink
                key={path}
                to={path}
                end={Boolean(end)}
                className={({ isActive }) => (isActive ? navLinkActive : navLinkInactive)}
              >
                {label}
              </NavLink>
            ))}
          </AccordionSection>
        </nav>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      </div>
    </div>
  )
}

export default function PosPengaturanLayout() {
  return (
    <PosSettingsOutletProvider>
      <PosPengaturanInner />
    </PosSettingsOutletProvider>
  )
}
