/**
 * Format a number with thousand separators (commas) for Indonesian format
 * @param {string|number} value - The value to format
 * @returns {string} Formatted string with commas
 */
export function formatNumberInput(value) {
  if (value === '' || value === null || value === undefined) return ''
  
  // Remove all non-digit characters except decimal point
  const numericValue = String(value).replace(/[^\d.]/g, '')
  
  // Split by decimal point if exists
  const parts = numericValue.split('.')
  const integerPart = parts[0]
  const decimalPart = parts[1]
  
  // Add thousand separators to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  // Combine with decimal part if exists
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
}

/**
 * Parse a formatted number string back to a number
 * @param {string} formattedValue - The formatted string (e.g., "1,234,567")
 * @returns {number} Parsed number
 */
export function parseFormattedNumber(formattedValue) {
  if (!formattedValue || formattedValue === '') return 0
  
  // Remove all commas and parse
  const numericString = String(formattedValue).replace(/,/g, '')
  const parsed = parseFloat(numericString)
  
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Handle input change for formatted number inputs
 * @param {Event} e - The input change event
 * @param {Function} onChange - Callback function with parsed numeric value
 */
export function handleFormattedNumberChange(e, onChange) {
  const inputValue = e.target.value
  
  // Allow empty string
  if (inputValue === '') {
    onChange('')
    return
  }
  
  // Remove all non-digit characters except decimal point
  const cleaned = inputValue.replace(/[^\d.]/g, '')
  
  // Prevent multiple decimal points
  const parts = cleaned.split('.')
  const integerPart = parts[0] || ''
  const decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('').substring(0, 2) : ''
  
  // Format the integer part with commas
  const formatted = formatNumberInput(integerPart + decimalPart)
  
  // Update the input value
  e.target.value = formatted
  
  // Call onChange with parsed numeric value
  const parsed = parseFormattedNumber(formatted)
  onChange(parsed === 0 && formatted === '' ? '' : parsed)
}
