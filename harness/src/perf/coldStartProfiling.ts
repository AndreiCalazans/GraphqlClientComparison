/**
 * Cold-start Hermes sampling profiler control (JS side). The native side (see
 * plugins/withColdStartProfiling.js) enables the Hermes sampling profiler in
 * MainApplication.onCreate for release builds compiled with
 * ENABLE_COLD_START_SAMPLING=true. Here we STOP + dump the sampled trace to
 * Downloads a fixed window after JS entry — long enough to cover a cold start
 * plus the scripted Maestro interaction of one test. The capture scripts pull
 * the cpuprofile from /sdcard/Download and source-map it.
 *
 * Safe no-op in dev or when react-native-release-profiler is unavailable.
 * Window is tunable via EXPO_PUBLIC_PROFILE_WINDOW_MS.
 */
const DEFAULT_WINDOW_MS = 20000;

let scheduled = false;

function loadProfiler(): { stopProfiling: (save: boolean) => Promise<string> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-release-profiler');
  } catch {
    return null;
  }
}

function isEnabled(): boolean {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (dev) return false;
  if (process.env.EXPO_PUBLIC_PROFILING === '0') return false;
  return true;
}

export function scheduleColdStartDump(windowMs?: number): void {
  if (scheduled) return;
  scheduled = true;
  if (!isEnabled()) return;

  const envWin = Number(process.env.EXPO_PUBLIC_PROFILE_WINDOW_MS);
  const win = windowMs ?? (Number.isFinite(envWin) && envWin > 0 ? envWin : DEFAULT_WINDOW_MS);

  const profiler = loadProfiler();
  if (!profiler) return;

  setTimeout(() => {
    Promise.resolve()
      .then(() => profiler.stopProfiling(true))
      .then((p) => {
        // eslint-disable-next-line no-console
        console.log('[RNPerf] cold-start profile dumped to', p);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[RNPerf] stopProfiling failed', e);
      });
  }, win);
}
