type PerfObserverHandle = {
  disconnect: () => void;
};

type ScreenMetricAggregate = {
  screen: string;
  action: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  lastAt: string;
};

interface StartPerformanceMonitorOptions {
  longTaskThresholdMs?: number;
  eventDurationThresholdMs?: number;
  logLayoutShift?: boolean;
}

const toFixed = (value: number) => Number(value.toFixed(2));
const screenMetricStore = new Map<string, ScreenMetricAggregate>();

const isPerfMonitorEnabled = () => {
  const env = (import.meta as any)?.env || {};
  return Boolean(env.DEV) && (env.VITE_PERF_MONITOR || 'true') === 'true';
};

const isObserverSupported = () => typeof window !== 'undefined' && typeof PerformanceObserver !== 'undefined';

const supportsEntryType = (entryType: string) => {
  if (!isObserverSupported()) return false;
  const supported = (PerformanceObserver as any).supportedEntryTypes;
  return Array.isArray(supported) && supported.includes(entryType);
};

const createObserver = (
  entryType: string,
  callback: (entries: PerformanceEntry[]) => void,
  options?: PerformanceObserverInit
): PerfObserverHandle | null => {
  if (!supportsEntryType(entryType)) return null;

  const observer = new PerformanceObserver((list) => {
    callback(list.getEntries());
  });

  observer.observe(options || { type: entryType, buffered: true });
  return { disconnect: () => observer.disconnect() };
};

export const startPerformanceMonitor = (options: StartPerformanceMonitorOptions = {}) => {
  if (!isObserverSupported()) return () => {};

  const longTaskThresholdMs = options.longTaskThresholdMs ?? 60;
  const eventDurationThresholdMs = options.eventDurationThresholdMs ?? 100;
  const logLayoutShift = options.logLayoutShift ?? false;

  const handles: PerfObserverHandle[] = [];

  const longTaskObserver = createObserver(
    'longtask',
    (entries) => {
      entries.forEach((entry) => {
        if (entry.duration >= longTaskThresholdMs) {
          console.warn('[perf] Long task', {
            durationMs: toFixed(entry.duration),
            startTimeMs: toFixed(entry.startTime),
            name: entry.name,
          });
        }
      });
    },
    { type: 'longtask', buffered: true }
  );
  if (longTaskObserver) handles.push(longTaskObserver);

  const eventObserver = createObserver(
    'event',
    (entries) => {
      entries.forEach((entry) => {
        if (entry.duration >= eventDurationThresholdMs) {
          const eventEntry = entry as PerformanceEventTiming;
          console.warn('[perf] Slow event handler', {
            name: eventEntry.name,
            durationMs: toFixed(eventEntry.duration),
            startTimeMs: toFixed(eventEntry.startTime),
            processingStartMs: toFixed(eventEntry.processingStart),
          });
        }
      });
    },
    {
      type: 'event',
      buffered: true,
      durationThreshold: eventDurationThresholdMs,
    }
  );
  if (eventObserver) handles.push(eventObserver);

  if (logLayoutShift) {
    const layoutShiftObserver = createObserver(
      'layout-shift',
      (entries) => {
        entries.forEach((entry) => {
          const shiftEntry = entry as any;
          if (!shiftEntry.hadRecentInput && shiftEntry.value > 0) {
            console.info('[perf] Layout shift', {
              value: toFixed(shiftEntry.value),
              startTimeMs: toFixed(shiftEntry.startTime),
            });
          }
        });
      },
      { type: 'layout-shift', buffered: true }
    );
    if (layoutShiftObserver) handles.push(layoutShiftObserver);
  }

  return () => {
    handles.forEach((handle) => handle.disconnect());
  };
};

export const recordScreenMetric = (
  screen: string,
  action: string,
  durationMs: number,
  options?: { warnThresholdMs?: number; details?: Record<string, unknown> }
) => {
  if (!isPerfMonitorEnabled() || !Number.isFinite(durationMs)) return;

  const key = `${screen}::${action}`;
  const current = screenMetricStore.get(key);

  if (current) {
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    current.lastMs = durationMs;
    current.lastAt = new Date().toISOString();
    screenMetricStore.set(key, current);
  } else {
    screenMetricStore.set(key, {
      screen,
      action,
      count: 1,
      totalMs: durationMs,
      maxMs: durationMs,
      lastMs: durationMs,
      lastAt: new Date().toISOString(),
    });
  }

  const warnThresholdMs = options?.warnThresholdMs ?? 120;
  if (durationMs >= warnThresholdMs) {
    console.warn('[perf] Slow screen interaction', {
      screen,
      action,
      durationMs: toFixed(durationMs),
      ...(options?.details || {}),
    });
  }
};

export const startScreenMetricsReporter = (intervalMs = 15000) => {
  if (!isPerfMonitorEnabled() || typeof window === 'undefined') {
    return () => {};
  }

  const id = window.setInterval(() => {
    if (screenMetricStore.size === 0) return;

    const rows = Array.from(screenMetricStore.values())
      .map((metric) => ({
        screen: metric.screen,
        action: metric.action,
        count: metric.count,
        avgMs: toFixed(metric.totalMs / metric.count),
        maxMs: toFixed(metric.maxMs),
        lastMs: toFixed(metric.lastMs),
        lastAt: metric.lastAt,
      }))
      .sort((a, b) => b.avgMs - a.avgMs);

    console.groupCollapsed('[perf] Screen metrics summary');
    console.table(rows);
    console.groupEnd();
  }, Math.max(5000, intervalMs));

  return () => {
    window.clearInterval(id);
  };
};
