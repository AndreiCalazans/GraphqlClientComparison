/**
 * RELAY variant. Uses compiled queries + a normalized RelayEnvironment store.
 * Home is one query with aliased searchAssetsV2 fields for the four category
 * sections + assetBySymbol for the watchlist symbols. Asset detail is a second
 * query. Live prices are written into the store via commitLocalUpdate so the
 * ticking UI drives Relay's store + fragment subscriptions.
 *
 * NOTE: graphql`` literals are transformed by babel-plugin-relay into requires
 * of ./src/relay/__generated__/*, which are produced by `yarn relay`. Run the
 * compiler before bundling.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  RelayEnvironmentProvider,
  useLazyLoadQuery,
  graphql,
} from 'react-relay';
import { commitLocalUpdate, ROOT_ID } from 'relay-runtime';

import { WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, AssetDetail, Section, SectionKey } from '../types';
import { getRelayEnvironment } from '../../relay/environment';
import type { relayHomeQuery } from '../../relay/__generated__/relayHomeQuery.graphql';
import type { relayDetailQuery } from '../../relay/__generated__/relayDetailQuery.graphql';

const environment = getRelayEnvironment();

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <RelayEnvironmentProvider environment={environment}>{children}</RelayEnvironmentProvider>
  );
}

const HomeQuery = graphql`
  query relayHomeQuery {
    gainers: searchAssetsV2(filter: TOP_GAINERS, first: 4) {
      edges { node { ...relayAssetFields @relay(mask: false) } }
    }
    losers: searchAssetsV2(filter: TOP_LOSERS, first: 4) {
      edges { node { ...relayAssetFields @relay(mask: false) } }
    }
    movers: searchAssetsV2(filter: TOP_MOVERS, first: 4) {
      edges { node { ...relayAssetFields @relay(mask: false) } }
    }
    listed: searchAssetsV2(filter: RECENTLY_LISTED, first: 4) {
      edges { node { ...relayAssetFields @relay(mask: false) } }
    }
    wlBTC: assetBySymbol(symbol: "BTC") { ...relayAssetFields @relay(mask: false) }
    wlETH: assetBySymbol(symbol: "ETH") { ...relayAssetFields @relay(mask: false) }
    wlSOL: assetBySymbol(symbol: "SOL") { ...relayAssetFields @relay(mask: false) }
    wlXRP: assetBySymbol(symbol: "XRP") { ...relayAssetFields @relay(mask: false) }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AssetFields = graphql`
  fragment relayAssetFields on Asset {
    uuid
    name
    displaySymbol
    imageUrl
    color
    latestPrice(quoteCurrency: "USD") {
      price
      percentChanges { hour day }
    }
  }
`;

const DetailQuery = graphql`
  query relayDetailQuery($symbol: String!) {
    assetBySymbol(symbol: $symbol) {
      uuid
      name
      displaySymbol
      imageUrl
      color
      descriptionV2(locale: "en")
      marketCapV2(quoteCurrency: "USD")
      volume24hV2(quoteCurrency: "USD")
      volumePercentChange24hV2(quoteCurrency: "USD")
      latestPrice(quoteCurrency: "USD") {
        price
        percentChanges { hour day week month year }
      }
    }
  }
`;

type RawAssetNode = {
  readonly uuid?: string | null;
  readonly name?: string | null;
  readonly displaySymbol?: string | null;
  readonly imageUrl?: string | null;
  readonly color?: string | null;
  readonly latestPrice?: {
    readonly price?: string | null;
    readonly percentChanges?: { readonly hour?: number | null; readonly day?: number | null } | null;
  } | null;
} | null;

function toAsset(n: RawAssetNode): Asset | null {
  if (!n) return null;
  return {
    uuid: n.uuid ?? '',
    symbol: n.displaySymbol ?? '',
    name: n.name ?? '',
    imageUrl: n.imageUrl ?? '',
    color: n.color ?? '#0052FF',
    price: Number(n.latestPrice?.price ?? 0),
    changeDay: Number(n.latestPrice?.percentChanges?.day ?? 0),
    changeHour: Number(n.latestPrice?.percentChanges?.hour ?? 0),
  };
}

// ---- app-local state (auth + watchlist) via a tiny external store ----
let account: Account = { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY };
let watchlist: Record<string, Asset> = {};
const localListeners = new Set<() => void>();
function emitLocal() {
  localListeners.forEach((l) => l());
}
function subLocal(cb: () => void) {
  localListeners.add(cb);
  return () => localListeners.delete(cb);
}

export const relayLayer: DataLayer = {
  id: 'relay',
  label: 'Relay',
  Provider,

  useHome() {
    // relayAssetFields is spread but read via the raw response here; Relay still
    // normalizes it. useLazyLoadQuery suspends until data lands.
    const data = useLazyLoadQuery<relayHomeQuery>(HomeQuery, {});
    const [ready, setReady] = useState(false);

    const collect = (
      edges: ReadonlyArray<{ readonly node?: RawAssetNode } | null> | null | undefined,
    ): Asset[] =>
      (edges ?? [])
        .map((e) => toAsset((e?.node ?? null) as RawAssetNode))
        .filter((a): a is Asset => a != null)
        .slice(0, 4);

    const byKey: Record<SectionKey, Asset[]> = {
      WATCHLIST: [data.wlBTC, data.wlETH, data.wlSOL, data.wlXRP]
        .map((n) => toAsset(n as RawAssetNode))
        .filter((a): a is Asset => a != null),
      TOP_GAINERS: collect(data.gainers?.edges),
      TOP_LOSERS: collect(data.losers?.edges),
      TOP_MOVERS: collect(data.movers?.edges),
      RECENTLY_LISTED: collect(data.listed?.edges),
    };

    const sections: Section[] = SECTION_ORDER.map((key) => ({ key, assets: byKey[key] }));

    useEffect(() => {
      if (!ready) {
        const symbols = new Set<string>(WATCHLIST_SYMBOLS);
        sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
        ensureTicker([...symbols]);
        setReady(true);
      }
    }, [ready, sections]);

    return { sections, loading: false };
  },

  useAccount() {
    return useSyncExternalStore(subLocal, () => account, () => account);
  },

  useAssetDetail(symbol: string) {
    const data = useLazyLoadQuery<relayDetailQuery>(DetailQuery, { symbol });
    const a = data.assetBySymbol;
    useEffect(() => {
      ensureTicker([symbol]);
    }, [symbol]);
    if (!a) return { detail: null, loading: false };
    const pc = a.latestPrice?.percentChanges;
    const detail: AssetDetail = {
      uuid: a.uuid ?? '',
      symbol: a.displaySymbol ?? symbol,
      name: a.name ?? '',
      imageUrl: a.imageUrl ?? '',
      color: a.color ?? '#0052FF',
      description: a.descriptionV2 ?? '',
      price: Number(a.latestPrice?.price ?? 0),
      marketCap: Number(a.marketCapV2 ?? 0),
      volume24h: Number(a.volume24hV2 ?? 0),
      volumePercentChange24h: Number(a.volumePercentChange24hV2 ?? 0),
      changes: {
        hour: Number(pc?.hour ?? 0),
        day: Number(pc?.day ?? 0),
        week: Number(pc?.week ?? 0),
        month: Number(pc?.month ?? 0),
        year: Number(pc?.year ?? 0),
      },
    };
    return { detail, loading: false };
  },

  useWatchlist() {
    const wl = useSyncExternalStore(subLocal, () => watchlist, () => watchlist);
    const isWatched = useCallback((uuid: string) => uuid in wl, [wl]);
    const watchedAssets = Object.values(wl);
    const toggle = useCallback((asset: Asset) => {
      const next = { ...watchlist };
      if (asset.uuid in next) delete next[asset.uuid];
      else next[asset.uuid] = asset;
      watchlist = next;
      emitLocal();
    }, []);
    return { isWatched, watchedAssets, toggle };
  },

  useAuth() {
    const acc = useSyncExternalStore(subLocal, () => account, () => account);
    const signIn = useCallback(() => {
      account = { signedIn: true, totalUsd: MOCK_BALANCE_USD, currency: MOCK_CURRENCY };
      emitLocal();
    }, []);
    const signOut = useCallback(() => {
      account = { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY };
      emitLocal();
    }, []);
    return { signedIn: acc.signedIn, signIn, signOut };
  },

  useLivePrice(symbol: string, fallback: number) {
    // Write ticks into the Relay store so the store + any readers update.
    const [, force] = useState(0);
    useEffect(() => {
      return subLive(() => {
        const p = getLivePrice(symbol);
        if (p == null) return;
        commitLocalUpdate(environment, (rstore) => {
          const root = rstore.get(ROOT_ID);
          if (root) root.setValue(p, `livePrice_${symbol}`);
        });
        force((n) => n + 1);
      });
    }, [symbol]);
    return getLivePrice(symbol) ?? fallback;
  },
};
