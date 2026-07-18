/**
 * VANILLA variant — the baseline. Plain fetch + module-level state exposed to
 * React via useSyncExternalStore. No caching library, no normalization, no
 * observer graph. This is the floor everything else is measured against.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { fetchAssetDetail, fetchSection, WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, AssetDetail, Section } from '../types';

// ---- module store ----
type State = {
  sections: Section[];
  loading: boolean;
  account: Account;
  details: Record<string, AssetDetail>;
  watchlist: Record<string, Asset>;
};

let state: State = {
  sections: [],
  loading: false,
  account: { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY },
  details: {},
  watchlist: {},
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

// ---- home load ----
let homeStarted = false;
async function loadHome() {
  if (homeStarted) return;
  homeStarted = true;
  setState({ loading: true });
  const results = await Promise.all(SECTION_ORDER.map((k) => fetchSection(k)));
  const sections: Section[] = SECTION_ORDER.map((key, i) => ({ key, assets: results[i] }));
  setState({ sections, loading: false });
  // Subscribe live prices for everything visible.
  const symbols = new Set<string>(WATCHLIST_SYMBOLS);
  sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
  ensureTicker([...symbols]);
}

// ---- detail load ----
const detailStarted = new Set<string>();
async function loadDetail(symbol: string) {
  if (detailStarted.has(symbol)) return;
  detailStarted.add(symbol);
  const d = await fetchAssetDetail(symbol);
  if (d) {
    setState({ details: { ...state.details, [symbol]: d } });
    ensureTicker([symbol]);
  }
}

export const vanillaLayer: DataLayer = {
  id: 'vanilla',
  label: 'Vanilla JS',

  useHome() {
    const sections = useStore((s) => s.sections);
    const loading = useStore((s) => s.loading);
    return { sections, loading };
  },

  prefetchHome() {
    void loadHome();
  },

  useAccount() {
    return useStore((s) => s.account);
  },

  useAssetDetail(symbol: string) {
    useEffect(() => {
      void loadDetail(symbol);
    }, [symbol]);
    const detail = useStore((s) => s.details[symbol] ?? null);
    return { detail, loading: detail == null };
  },

  useWatchlist() {
    const watchlist = useStore((s) => s.watchlist);
    const isWatched = useCallback((uuid: string) => uuid in watchlist, [watchlist]);
    const watchedAssets = Object.values(watchlist);
    const toggle = useCallback((asset: Asset) => {
      const next = { ...state.watchlist };
      if (asset.uuid in next) delete next[asset.uuid];
      else next[asset.uuid] = asset;
      setState({ watchlist: next });
    }, []);
    return { isWatched, watchedAssets, toggle };
  },

  useAuth() {
    const signedIn = useStore((s) => s.account.signedIn);
    const signIn = useCallback(() => {
      setState({ account: { signedIn: true, totalUsd: MOCK_BALANCE_USD, currency: MOCK_CURRENCY } });
    }, []);
    const signOut = useCallback(() => {
      setState({ account: { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY } });
    }, []);
    return { signedIn, signIn, signOut };
  },

  useLivePrice(symbol: string, fallback: number) {
    const ref = useRef(fallback);
    return useSyncExternalStore(
      subLive,
      () => {
        const p = getLivePrice(symbol);
        if (p != null) ref.current = p;
        return ref.current ?? fallback;
      },
      () => fallback,
    );
  },
};
