import { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDataLayer } from '../data/registry';
import { SECTION_TITLE } from '../data/types';
import type { Asset } from '../data/types';
import { AssetRow } from '../ui/AssetRow';
import { formatUsd } from '../ui/format';

type Props = {
  onOpenAsset: (asset: Asset) => void;
  onOpenSignIn: () => void;
};

export function HomeScreen({ onOpenAsset, onOpenSignIn }: Props) {
  const layer = useDataLayer();
  const insets = useSafeAreaInsets();
  const { sections, loading } = layer.useHome();
  const account = layer.useAccount();

  useEffect(() => {
    layer.prefetchHome?.();
  }, [layer]);

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}
      testID="home-scroll"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <Text
          style={styles.authLink}
          onPress={account.signedIn ? undefined : onOpenSignIn}
          testID={account.signedIn ? 'auth-signed-in' : 'btn-signin'}
        >
          {account.signedIn ? 'Signed in' : 'Sign in'}
        </Text>
      </View>

      {account.signedIn ? (
        <View style={styles.balanceCard} testID="balance-card">
          <Text style={styles.balanceLabel}>Total balance</Text>
          <Text style={styles.balanceValue} testID="balance-value">
            {formatUsd(account.totalUsd)}
          </Text>
        </View>
      ) : null}

      {loading && sections.length === 0 ? (
        <View style={styles.loading} testID="home-loading">
          <ActivityIndicator color="#0052FF" />
          <Text style={styles.loadingText}>loading markets…</Text>
        </View>
      ) : null}

      {sections.map((section) => (
        <View key={section.key} style={styles.section} testID={`section-${section.key}`}>
          <Text style={styles.sectionTitle}>{SECTION_TITLE[section.key]}</Text>
          {section.assets.map((asset, i) => (
            <LiveRow
              key={`${section.key}-${asset.uuid || asset.symbol}`}
              asset={asset}
              testID={`row-${section.key}-${i}`}
              onPress={onOpenAsset}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/** A row that subscribes to the live price for its symbol. */
function LiveRow({
  asset,
  testID,
  onPress,
}: {
  asset: Asset;
  testID: string;
  onPress: (a: Asset) => void;
}) {
  const layer = useDataLayer();
  const live = layer.useLivePrice(asset.symbol, asset.price);
  return <AssetRow asset={asset} livePrice={live} testID={testID} onPress={onPress} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0b0e14' },
  authLink: { fontSize: 15, fontWeight: '600', color: '#0052FF' },
  balanceCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#0b0e14',
  },
  balanceLabel: { color: '#9aa4b2', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 4 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { color: '#8a94a6', marginTop: 10 },
  section: { marginTop: 8, marginBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0b0e14',
    paddingHorizontal: 16,
    marginBottom: 4,
    marginTop: 8,
  },
});
