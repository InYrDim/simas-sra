"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

type ProgressState = {
  visible: boolean;
  value: number; // 0-100
};

// Timing knobs (ms)
const TRICKLE_INTERVAL_MS = 200;
const TRICKLE_MAX = 90;
const MIN_DISPLAY_MS = 250; // minimum time the bar stays visible (avoid flash on fast navs)
const SETTLE_MS = 300; // no DOM mutations for this long => navigation committed
const HARD_CAP_MS = 15_000; // safety net so the bar never gets stuck
const SETTLE_CHECK_INTERVAL_MS = 100;
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
let lastMutationAt = 0;
let barRoot: HTMLElement | null = null;
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
  if (state.visible) return;
  startedAt = Date.now();
  lastMutationAt = startedAt;
  setState({ visible: true, value: 8 });
  trickleTimer = setInterval(trickle, TRICKLE_INTERVAL_MS);
}

/**
 * Top progress bar that shows during client-side page transitions.
 *
 * Next.js App Router runs every navigation (Link clicks, router.push/replace,
 * back/forward) through history.pushState/replaceState, so we patch those to
 * detect the START of a navigation. The App Router COMMITS the new page by
 * applying the RSC payload to the DOM, so a MutationObserver on <body> tells
 * us when the page has actually rendered — once mutations stop for a moment,
 * the bar finishes. This works regardless of usePathname/useSearchParams
 * timing and without any external dependency.
 */
export function NavigationProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const { visible, value } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    barRoot = barRef.current;

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

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Ignore mutations caused by the progress bar's own re-renders.
        const target = mutation.target;
        if (barRoot && (target === barRoot || barRoot.contains(target))) continue;
        lastMutationAt = Date.now();
        return;
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const settleCheck = setInterval(() => {
      if (!state.visible) return;
      const now = Date.now();
      if (
        now - startedAt > HARD_CAP_MS ||
        (now - startedAt >= MIN_DISPLAY_MS && now - lastMutationAt >= SETTLE_MS)
      ) {
        finish();
      }
    }, SETTLE_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("popstate", onPopState);
      observer.disconnect();
      clearInterval(settleCheck);
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
