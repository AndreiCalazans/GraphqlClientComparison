import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDataLayer } from '../data/registry';
import type { Asset } from '../data/types';
import { changeColor, formatCompact, formatPct, formatUsd } from '../ui/format';

type Props = {
  asset: Asset;
  onBack: () => void;
};

export function AssetDetailScreen({ asset, onBack }: Props) {
  const layer = useDataLayer();
  const insets = useSafeAreaInsets();
  const { detail, loading } = layer.useAssetDetail(asset.symbol);
  const watchlist = layer.useWatchlist();
  const live = layer.useLivePrice(asset.symbol, detail?.price ?? asset.price);

  const watched = watchlist.isWatched(asset.uuid);

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 60 }}
      testID="detail-scroll"
    >
      <View style={styles.topBar}>
        <Pressable onPress={onBack} testID="btn-back" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      </View>

      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: asset.color }]}>
          {asset.imageUrl ? (
            <Image source={{ uri: asset.imageUrl }} style={styles.iconImg} />
          ) : (
            <Text style={styles.iconText}>{asset.symbol.slice(0, 1)}</Text>
          )}
        </View>
        <Text style={styles.name}>{detail?.name ?? asset.name}</Text>
        <Text style={styles.symbol}>{asset.symbol}</Text>
        <Text style={styles.price} testID="detail-price">
          {formatUsd(live || detail?.price || asset.price)}
        </Text>
        <Text style={[styles.change, { color: changeColor(detail?.changes.day ?? asset.changeDay) }]}>
          {formatPct(detail?.changes.day ?? asset.changeDay)} today
        </Text>
      </View>

      <Pressable
        style={[styles.watchBtn, watched ? styles.watchBtnOn : null]}
        onPress={() => watchlist.toggle(asset)}
        testID="btn-watch-toggle"
      >
        <Text style={[styles.watchText, watched ? styles.watchTextOn : null]}>
          {watched ? '★ Watching' : '☆ Add to watchlist'}
        </Text>
      </Pressable>

      {loading && !detail ? (
        <View style={styles.loading} testID="detail-loading">
          <ActivityIndicator color="#0052FF" />
        </View>
      ) : null}

      {detail ? (
        <>
          <View style={styles.statsRow}>
            <Stat label="Market cap" value={formatCompact(detail.marketCap)} />
            <Stat label="24h volume" value={formatCompact(detail.volume24h)} />
            <Stat
              label="Vol change 24h"
              value={formatPct(detail.volumePercentChange24h)}
              color={changeColor(detail.volumePercentChange24h)}
            />
          </View>

          <View style={styles.changesGrid}>
            <Change label="1H" v={detail.changes.hour} />
            <Change label="1D" v={detail.changes.day} />
            <Change label="1W" v={detail.changes.week} />
            <Change label="1M" v={detail.changes.month} />
            <Change label="1Y" v={detail.changes.year} />
          </View>

          <Text style={styles.aboutTitle}>About {detail.name}</Text>
          <Text style={styles.description} testID="detail-description">
            {detail.description}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Change({ label, v }: { label: string; v: number }) {
  return (
    <View style={styles.changeCell}>
      <Text style={styles.changeCellLabel}>{label}</Text>
      <Text style={[styles.changeCellValue, { color: changeColor(v) }]}>{formatPct(v)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  topBar: { paddingHorizontal: 16, paddingBottom: 4 },
  back: { color: '#0052FF', fontSize: 16, fontWeight: '600' },
  head: { alignItems: 'center', paddingVertical: 16 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImg: { width: 56, height: 56 },
  iconText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  name: { fontSize: 20, fontWeight: '700', color: '#0b0e14', marginTop: 10 },
  symbol: { fontSize: 14, color: '#8a94a6', marginTop: 2 },
  price: { fontSize: 34, fontWeight: '800', color: '#0b0e14', marginTop: 12 },
  change: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  watchBtn: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#0052FF',
    alignItems: 'center',
  },
  watchBtnOn: { backgroundColor: '#0052FF' },
  watchText: { color: '#0052FF', fontSize: 16, fontWeight: '700' },
  watchTextOn: { color: '#fff' },
  loading: { paddingVertical: 30, alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  stat: { flex: 1 },
  statLabel: { color: '#8a94a6', fontSize: 12 },
  statValue: { color: '#0b0e14', fontSize: 15, fontWeight: '700', marginTop: 2 },
  changesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
  },
  changeCell: { alignItems: 'center', flex: 1 },
  changeCellLabel: { color: '#8a94a6', fontSize: 12 },
  changeCellValue: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0b0e14',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: '#3a4152',
    paddingHorizontal: 16,
  },
});
