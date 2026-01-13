import { useState, useEffect } from 'react'
import { formatNumberInput, parseFormattedNumber } from '../utils/numberFormatter'

export default function FormattedNumberInput({ value, onChange, placeholder = '0', className = '', ...props }) {
  const [displayValue, setDisplayValue] = useState('')

  // Update display value when prop value changes
  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setDisplayValue('')
    } else if (value === 0) {
      setDisplayValue('')
    } else {
      setDisplayValue(formatNumberInput(value))
    }
  }, [value])

  const handleChange = (e) => {
    const inputValue = e.target.value
    
    // Allow empty string
    if (inputValue === '') {
      setDisplayValue('')
      onChange('')
      return
    }

    // Remove all non-digit characters except decimal point
    let cleaned = inputValue.replace(/[^\d.]/g, '')
    
    // Prevent multiple decimal points
    const parts = cleaned.split('.')
    cleaned = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('').substring(0, 2) : '')
    
    // Format with commas
    const formatted = formatNumberInput(cleaned)
    setDisplayValue(formatted)
    
    // Parse and call onChange with numeric value
    const parsed = parseFormattedNumber(formatted)
    onChange(parsed === 0 && formatted === '' ? '' : parsed)
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  )
}
