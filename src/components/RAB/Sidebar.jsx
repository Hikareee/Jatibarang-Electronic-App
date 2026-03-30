import { Layers, ClipboardList, Calculator, ChevronLeft, ChevronRight } from 'lucide-react'

const TABS = [
  { id: 'materials', label: 'Material & upah', icon: Layers },
  { id: 'workItems', label: 'Pekerjaan', icon: ClipboardList },
  { id: 'calculator', label: 'Kalkulator RAB', icon: Calculator },
  { id: 'ai', label: 'AI Consultant', icon: ClipboardList },
]

/**
 * Collapsible inner sidebar for the RAB workspace (tabs).
 */
export default function RABSidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }) {
  return (
    <aside
      className={`flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 px-2">
            RAB Engine
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title={collapsed ? 'Lebarkan panel' : 'Ciutkan panel'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              title={collapsed ? tab.label : ''}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-left">{tab.label}</span>}
              {collapsed && <span className="sr-only">{tab.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
