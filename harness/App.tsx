import { Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataLayerProvider, LAYERS, resolveVariantId } from './src/data/registry';
import type { Asset } from './src/data/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { ProfilerControl } from './src/perf/ProfilerControl';

// The Hermes sampling profiler is enabled natively in MainApplication.onCreate
// (see plugins/withColdStartProfiling.js), so sampling starts before the JS
// bundle runs. It is STOPPED on demand by the ProfilerControl button, which the
// Maestro flow taps at the end of each test — so the WHOLE test window is
// captured (not a fixed 20 s slice; T3 runs ~80 s).

type Route =
  | { name: 'home' }
  | { name: 'detail'; asset: Asset }
  | { name: 'signin' };

export default function App() {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  useEffect(() => {
    Linking.getInitialURL().then((u) => setInitialUrl(u ?? null)).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => setInitialUrl(url));
    return () => sub.remove();
  }, []);
  const variantId = useMemo(() => resolveVariantId(initialUrl), [initialUrl]);
  const layer = LAYERS[variantId];

  const [route, setRoute] = useState<Route>({ name: 'home' });

  return (
    <SafeAreaProvider>
      <DataLayerProvider layer={layer}>
        <View style={styles.fill} testID={`app-${variantId}`}>
          <Suspense fallback={<Loading />}>
            {route.name === 'home' ? (
              <HomeScreen
                onOpenAsset={(asset) => setRoute({ name: 'detail', asset })}
                onOpenSignIn={() => setRoute({ name: 'signin' })}
              />
            ) : null}
            {route.name === 'detail' ? (
              <AssetDetailScreen
                asset={route.asset}
                onBack={() => setRoute({ name: 'home' })}
              />
            ) : null}
            {route.name === 'signin' ? (
              <SignInScreen onDone={() => setRoute({ name: 'home' })} />
            ) : null}
          </Suspense>
          <ProfilerControl />
        </View>
      </DataLayerProvider>
    </SafeAreaProvider>
  );
}

function Loading() {
  return (
    <View style={styles.loading} testID="app-loading">
      <ActivityIndicator color="#0052FF" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
