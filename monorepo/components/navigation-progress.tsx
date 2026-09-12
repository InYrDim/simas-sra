"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ProgressState = {
  visible: boolean;
  value: number; // 0-100
};

// Timing knobs (ms)
const TRICKLE_INTERVAL_MS = 200;
const TRICKLE_MAX = 90;
const MIN_DISPLAY_MS = 250; // minimum time the bar stays visible (avoid flash on fast navs)
const HARD_CAP_MS = 15_000; // safety net so the bar never gets stuck
const HIDE_DELAY_MS = 120;

let state: ProgressState = { visible: false, value: 0 };
const listeners = new Set<() => void>();

function setState(patch: Partial<ProgressState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

// --- navigation lifecycle (module-level singleton, survives remounts/HMR) ---
let trickleTimer: ReturnType<typeof setInterval> | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
let historyPatched = false;

function trickle() {
  const next = Math.min(TRICKLE_MAX, state.value + (TRICKLE_MAX - state.value) * 0.08);
  setState({ value: next });
}

function finish() {
  if (!state.visible) return;
  if (finishTimer) clearTimeout(finishTimer);
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
  if (hardCapTimer) {
    clearTimeout(hardCapTimer);
    hardCapTimer = null;
  }
  setState({ value: 100 });
  finishTimer = setTimeout(() => {
    setState({ visible: false, value: 0 });
  }, HIDE_DELAY_MS);
}

function start() {
  // Cancel a pending hide so a back-to-back navigation keeps the bar running.
  if (finishTimer) {
    clearTimeout(finishTimer);
    finishTimer = null;
  }
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
  if (hardCapTimer) {
    clearTimeout(hardCapTimer);
    hardCapTimer = null;
  }
  if (state.visible) return;
  startedAt = Date.now();
  setState({ visible: true, value: 8 });
  trickleTimer = setInterval(trickle, TRICKLE_INTERVAL_MS);
  // Safety net: never let the bar get stuck if the route-commit signal is missed.
  hardCapTimer = setTimeout(finish, HARD_CAP_MS);
}

/**
 * Top progress bar that shows during client-side page transitions.
 *
 * Next.js App Router runs every navigation (Link clicks, router.push/replace,
 * back/forward) through history.pushState/replaceState, so we patch those to
 * detect the START of a navigation. The App Router COMMITS the new route by
 * re-rendering this component with a new pathname/searchParams — that is the
 * reliable "page finished" signal (see the effect below). We deliberately do
 * NOT infer completion from DOM-mutation silence, because any widget that keeps
 * mutating the page (live clocks, polling) would keep the bar stuck.
 */
export function NavigationProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const { visible, value } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The App Router commits the new route by re-rendering this component with a
  // new pathname/searchParams. That is the reliable "page finished" signal.
  useEffect(() => {
    finish();
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!historyPatched) {
      historyPatched = true;
      const originalPush = history.pushState.bind(history);
      const originalReplace = history.replaceState.bind(history);
      history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
        originalPush(data, unused, url);
        queueMicrotask(start);
      }) as typeof history.pushState;
      history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
        originalReplace(data, unused, url);
        queueMicrotask(start);
      }) as typeof history.replaceState;
    }

    const onPopState = () => start();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <div
      ref={barRef}
      role="progressbar"
      aria-label="Memuat halaman"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={visible ? Math.round(value) : undefined}
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-[2px] opacity-0 transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full rounded-r-full bg-primary shadow-[0_0_10px] shadow-primary/70 transition-[width] duration-200 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
