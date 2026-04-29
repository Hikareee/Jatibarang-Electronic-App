/** Baris satu opsi Pengaturan: judul + deskripsi + toggle. */
export function SettingToggleRow({
  title,
  subLabel,
  description,
  on,
  onChange,
  statusTone = 'muted',
  disabled,
}) {
  return (
    <div className="flex gap-4 border-b border-slate-100 py-5 last:border-0 dark:border-slate-800">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-[15px] font-semibold text-blue-700 dark:text-blue-400">
            {title}
          </h3>
          {subLabel ? (
            <span
              className={`text-[13px] font-medium ${
                statusTone === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : statusTone === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {subLabel}
            </span>
          ) : null}
        </div>
        <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          onChange(!on)
        }}
        className={`relative h-8 w-[3.35rem] shrink-0 rounded-full transition-colors disabled:opacity-45 ${on ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-[calc(100%-1.625rem)]' : 'left-1'}`}
        />
      </button>
    </div>
  )
}
