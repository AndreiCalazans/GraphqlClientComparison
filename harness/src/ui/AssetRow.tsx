import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Asset } from '../data/types';
import { changeColor, formatPct, formatUsd } from './format';

type Props = {
  asset: Asset;
  livePrice: number;
  testID?: string;
  onPress: (asset: Asset) => void;
};

/**
 * One asset row. Identical rendering for every variant — the only variance
 * between variants is who supplies `livePrice` and how `asset` was fetched.
 */
function AssetRowInner({ asset, livePrice, testID, onPress }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => onPress(asset)}
      testID={testID}
      accessibilityLabel={`asset-${asset.symbol}`}
    >
      <View style={[styles.icon, { backgroundColor: asset.color }]}>
        {asset.imageUrl ? (
          <Image source={{ uri: asset.imageUrl }} style={styles.iconImg} />
        ) : (
          <Text style={styles.iconText}>{asset.symbol.slice(0, 1)}</Text>
        )}
      </View>
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {asset.name}
        </Text>
        <Text style={styles.symbol}>{asset.symbol}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatUsd(livePrice || asset.price)}</Text>
        <Text style={[styles.change, { color: changeColor(asset.changeDay) }]}>
          {formatPct(asset.changeDay)}
        </Text>
      </View>
    </Pressable>
  );
}

export const AssetRow = memo(AssetRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImg: { width: 40, height: 40 },
  iconText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  mid: { flex: 1, marginLeft: 12 },
  name: { color: '#0b0e14', fontSize: 15, fontWeight: '600' },
  symbol: { color: '#8a94a6', fontSize: 13, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  price: { color: '#0b0e14', fontSize: 15, fontWeight: '600' },
  change: { fontSize: 13, marginTop: 2, fontWeight: '500' },
});
