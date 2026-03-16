import { useState, useEffect, useCallback } from "react";

/**
 * Return a debounced version of the value (e.g. for search input).
 * Shared across features; use for any input that should trigger updates after a delay.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Return a setter that updates state and a debounced value for reads.
 */
export function useDebouncedState<T>(
  initial: T,
  delayMs: number
): [T, T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const debounced = useDebouncedValue(value, delayMs);
  const setValueCallback = useCallback((v: T) => setValue(v), []);
  return [value, debounced, setValueCallback];
}
