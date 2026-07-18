/**
 * PURE ZUSTAND variant. A single zustand store holds sections, details, live
 * prices, watchlist and account. Async fetches write into the store via set().
 * Components select slices with useStore(selector). This measures zustand's
 * selector/subscription cost as the data-layer, with no query library.
 */
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { fetchAssetDetail, fetchSection, WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, AssetDetail, Section } from '../types';

type Store = {
  sections: Section[];
  loading: boolean;
  details: Record<string, AssetDetail>;
  prices: Record<string, number>;
  watchlist: Record<string, Asset>;
  account: Account;
  loadHome: () => Promise<void>;
  loadDetail: (symbol: string) => Promise<void>;
  setPrice: (symbol: string, price: number) => void;
  toggleWatch: (asset: Asset) => void;
  signIn: () => void;
  signOut: () => void;
};

let homeStarted = false;
const detailStarted = new Set<string>();

const useStore = create<Store>((set, get) => ({
  sections: [],
  loading: false,
  details: {},
  prices: {},
  watchlist: {},
  account: { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY },

  loadHome: async () => {
    if (homeStarted) return;
    homeStarted = true;
    set({ loading: true });
    const results = await Promise.all(SECTION_ORDER.map((k) => fetchSection(k)));
    const sections = SECTION_ORDER.map((key, i) => ({ key, assets: results[i] }));
    set({ sections, loading: false });
    const symbols = new Set<string>(WATCHLIST_SYMBOLS);
    sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
    ensureTicker([...symbols]);
  },

  loadDetail: async (symbol) => {
    if (detailStarted.has(symbol)) return;
    detailStarted.add(symbol);
    const d = await fetchAssetDetail(symbol);
    if (d) {
      set((s) => ({ details: { ...s.details, [symbol]: d } }));
      ensureTicker([symbol]);
    }
  },

  setPrice: (symbol, price) => set((s) => ({ prices: { ...s.prices, [symbol]: price } })),
  toggleWatch: (asset) =>
    set((s) => {
      const next = { ...s.watchlist };
      if (asset.uuid in next) delete next[asset.uuid];
      else next[asset.uuid] = asset;
      return { watchlist: next };
    }),
  signIn: () => set({ account: { signedIn: true, totalUsd: MOCK_BALANCE_USD, currency: MOCK_CURRENCY } }),
  signOut: () => set({ account: { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY } }),
}));

export const zustandLayer: DataLayer = {
  id: 'zustand',
  label: 'Zustand',

  useHome() {
    const sections = useStore((s) => s.sections);
    const loading = useStore((s) => s.loading);
    return { sections, loading };
  },

  prefetchHome() {
    void useStore.getState().loadHome();
  },

  useAccount() {
    return useStore((s) => s.account);
  },

  useAssetDetail(symbol: string) {
    const loadDetail = useStore((s) => s.loadDetail);
    useEffect(() => {
      void loadDetail(symbol);
    }, [symbol, loadDetail]);
    const detail = useStore((s) => s.details[symbol] ?? null);
    return { detail, loading: detail == null };
  },

  useWatchlist() {
    const watchlist = useStore((s) => s.watchlist);
    const toggleWatch = useStore((s) => s.toggleWatch);
    const isWatched = useCallback((uuid: string) => uuid in watchlist, [watchlist]);
    const watchedAssets = Object.values(watchlist);
    return { isWatched, watchedAssets, toggle: toggleWatch };
  },

  useAuth() {
    const signedIn = useStore((s) => s.account.signedIn);
    const signIn = useStore((s) => s.signIn);
    const signOut = useStore((s) => s.signOut);
    return { signedIn, signIn, signOut };
  },

  useLivePrice(symbol: string, fallback: number) {
    const setPrice = useStore((s) => s.setPrice);
    useEffect(() => {
      return subLive(() => {
        const p = getLivePrice(symbol);
        if (p != null) setPrice(symbol, p);
      });
    }, [symbol, setPrice]);
    return useStore((s) => s.prices[symbol] ?? fallback);
  },
};
