import { useEffect, useState } from "react";

/**
 * True once `active` has stayed true for `delayMs`; false again as soon as it
 * turns false. Used to explain slow loads only when they are actually slow,
 * so fast loads never flash a message.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}
