import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isProfilerStopped,
  stopProfiler,
  subscribeProfiler,
} from './coldStartProfiling';

/**
 * A small always-on-top control the Maestro flow taps at the END of each e2e
 * test to stop the Hermes sampling profiler and dump the cpuprofile. Once the
 * file is written it renders a `profiler-done` marker the flow asserts on before
 * finishing, so the host only pulls a fully-written profile (the native
 * "Saved results from Profiler…" toast follows ~1 s later).
 *
 * It floats bottom-right, tiny, and is marked non-a11y-hiding so it never
 * interferes with the app's own hierarchy fetches.
 */
export function ProfilerControl() {
  const insets = useSafeAreaInsets();
  const stopped = useSyncExternalStore(
    subscribeProfiler,
    isProfilerStopped,
    isProfilerStopped,
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 8 }]}
    >
      {stopped ? (
        <View style={styles.done} testID="profiler-done">
          <Text style={styles.doneText}>profiler-done</Text>
        </View>
      ) : (
        <Pressable
          style={styles.btn}
          onPress={() => {
            void stopProfiler();
          }}
          testID="btn-stop-profiler"
          accessibilityLabel="stop-profiler"
        >
          <Text style={styles.btnText}>■</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    zIndex: 9999,
    elevation: 9999,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11,14,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  done: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(5,177,105,0.9)',
  },
  doneText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
