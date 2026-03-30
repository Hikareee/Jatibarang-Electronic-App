import { useRef, useEffect, useCallback } from 'react'

/**
 * @param {(...args: any[]) => void} fn
 * @param {number} delay
 */
export function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn)
  const timeoutRef = useRef(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        fnRef.current(...args)
      }, delay)
    },
    [delay]
  )
}
