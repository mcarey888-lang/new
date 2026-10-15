/**
 * The hills you have ticked off, held for a screen.
 *
 * Deliberately standalone rather than part of AppContext: a tick is not an
 * activity and must not reach anything that credits one, so it has no
 * business sitting beside the training plan and the expedition state. See
 * `summitTicks` for what a tick is and, more importantly, what it is not.
 *
 * Writes go to the device and nowhere else, so ticking works with no signal
 * and never waits for one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readTicks,
  tickedIds,
  toggleTick,
  writeTicks,
  type SummitTick,
} from "@/utils/summitTicks";

export interface UseSummitTicks {
  ticks: SummitTick[];
  /** Bare catalogue ids, which is the shape the map compares. */
  ids: string[];
  /** True once the stored list has been read, so a caller can avoid sending
   *  an empty list to the map and briefly unticking everything. */
  ready: boolean;
  toggle: (summit: { id: string | null | undefined; name: string }) => void;
}

export function useSummitTicks(): UseSummitTicks {
  const [ticks, setTicks] = useState<SummitTick[]>([]);
  const [ready, setReady] = useState(false);
  /* Read inside the callback without making it change identity every time a
     tick is added, which would restart every effect that depends on it. */
  const ticksRef = useRef<SummitTick[]>([]);

  useEffect(() => {
    let cancelled = false;
    void readTicks().then(stored => {
      if (cancelled) return;
      ticksRef.current = stored;
      setTicks(stored);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback((summit: { id: string | null | undefined; name: string }) => {
    const next = toggleTick(ticksRef.current, summit);
    /* Same array means nothing to do — a tap with no identity behind it. */
    if (next === ticksRef.current) return;
    ticksRef.current = next;
    /* Shown immediately and saved after. The save cannot fail in a way worth
       making somebody wait for, and a tick that appears only once the disk
       agrees feels broken on an old phone. */
    setTicks(next);
    void writeTicks(next);
  }, []);

  return { ticks, ids: tickedIds(ticks), ready, toggle };
}
