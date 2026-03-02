import { useState } from 'react'
import { X } from 'lucide-react'
import FormattedNumberInput from './FormattedNumberInput'

export default function OptionalFieldPopup({ label, value, onChange, onClose }) {
  const [localValue, setLocalValue] = useState(value || { account: '', type: 'Rp', value: 0 })

  const handleSave = () => {
    onChange(localValue)
  }

  const handleClose = () => {
    handleSave()
    onClose()
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <select
            value={localValue.account}
            onChange={(e) => {
              const newValue = { ...localValue, account: e.target.value }
              setLocalValue(newValue)
              onChange(newValue)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-900 text-sm"
          >
            <option value="">Select account...</option>
            <option value="1-10001">1-10001 Kas</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                const newValue = { ...localValue, type: '%' }
                setLocalValue(newValue)
                onChange(newValue)
              }}
              className={`px-3 py-1 text-sm ${
                localValue.type === '%'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              %
            </button>
            <button
              onClick={() => {
                const newValue = { ...localValue, type: 'Rp' }
                setLocalValue(newValue)
                onChange(newValue)
              }}
              className={`px-3 py-1 text-sm ${
                localValue.type === 'Rp'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Rp
            </button>
          </div>
          <FormattedNumberInput
            value={localValue.value}
            onChange={(value) => {
              const newValue = { ...localValue, value: value }
              setLocalValue(newValue)
              onChange(newValue)
            }}
            className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-900 bg-white text-gray-900 text-sm"
          />
          <span className="font-bold text-gray-900 dark:text-white">
            {new Intl.NumberFormat('id-ID').format(localValue.value || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
