import { Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataLayerProvider, LAYERS, resolveVariantId } from './src/data/registry';
import type { Asset } from './src/data/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { scheduleColdStartDump } from './src/perf/coldStartProfiling';

// Start the Hermes cold-start sampling profiler window as early as possible in
// the JS entry (no-op in dev). The Maestro flow completes inside this window.
scheduleColdStartDump();

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
