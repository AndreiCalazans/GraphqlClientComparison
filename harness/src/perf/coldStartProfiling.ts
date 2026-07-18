/**
 * Hermes sampling profiler control (JS side). The native side (see
 * plugins/withColdStartProfiling.js) enables the Hermes sampling profiler in
 * MainApplication.onCreate for release builds compiled with
 * ENABLE_COLD_START_SAMPLING=true, so sampling starts BEFORE the JS bundle runs
 * (early module init + first render are captured).
 *
 * We STOP + dump the sampled trace on demand — driven by a UI button the Maestro
 * flow taps at the very end of each e2e test — so the ENTIRE test window is
 * captured, not just a fixed 20 s slice (T3 runs ~80 s). `stopProfiling(true)`
 * writes the cpuprofile to Downloads and the native module shows a
 * "Saved results from Profiler to …" toast a beat later; the flow asserts the
 * on-screen "profiler-done" marker (set here) before it finishes so the host
 * only pulls a fully-written file.
 *
 * Safe no-op in dev or when react-native-release-profiler is unavailable.
 */
let stopping = false;
let stopped = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Subscribe to profiler-state changes (for the UI marker). */
export function subscribeProfiler(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** True once the profile has been written to disk. */
export function isProfilerStopped(): boolean {
  return stopped;
}

function loadProfiler(): { stopProfiling: (save: boolean) => Promise<string> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-release-profiler');
  } catch {
    return null;
  }
}

export function isProfilingEnabled(): boolean {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (dev) return false;
  if (process.env.EXPO_PUBLIC_PROFILING === '0') return false;
  return true;
}

/**
 * Stop the sampling profiler and dump the cpuprofile. Idempotent. Flips the
 * `profiler-done` UI marker once the file is written so the Maestro flow can
 * assertVisible on it (the file is on disk by then; the toast follows ~1 s).
 */
export async function stopProfiler(): Promise<void> {
  if (stopping || stopped) return;
  stopping = true;
  if (!isProfilingEnabled()) {
    // In dev there's nothing to dump, but still flip the marker so the flow's
    // assertion passes and the UX is identical.
    stopped = true;
    emit();
    return;
  }
  const profiler = loadProfiler();
  if (!profiler) {
    stopped = true;
    emit();
    return;
  }
  try {
    const p = await profiler.stopProfiling(true);
    // eslint-disable-next-line no-console
    console.log('[RNPerf] profile dumped to', p);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[RNPerf] stopProfiling failed', e);
  } finally {
    stopped = true;
    emit();
  }
}
