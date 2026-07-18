/**
 * PURE JOTAI variant. Atoms hold sections, details, prices, watchlist, account.
 * Data is loaded imperatively into a shared default store; components read with
 * useAtomValue and write with useSetAtom. Live prices go into a family of price
 * atoms so each row only re-renders when its own symbol ticks — measuring
 * Jotai's atom-graph propagation cost as the data-layer.
 */
import { useCallback, useEffect } from 'react';
import { atom, useAtomValue, useSetAtom, createStore, Provider as JotaiProvider } from 'jotai';

import { fetchAssetDetail, fetchSection, WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, AssetDetail, Section } from '../types';

const store = createStore();

const sectionsAtom = atom<Section[]>([]);
const loadingAtom = atom<boolean>(false);
const detailsAtom = atom<Record<string, AssetDetail>>({});
const watchlistAtom = atom<Record<string, Asset>>({});
const accountAtom = atom<Account>({ signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY });

// Per-symbol price atoms so a tick only wakes the rows for that symbol.
const priceAtoms = new Map<string, ReturnType<typeof atom<number>>>();
function priceAtomFor(symbol: string, fallback: number) {
  let a = priceAtoms.get(symbol);
  if (!a) {
    a = atom<number>(fallback);
    priceAtoms.set(symbol, a);
  }
  return a;
}

function Provider({ children }: { children: React.ReactNode }) {
  return <JotaiProvider store={store}>{children}</JotaiProvider>;
}

let homeStarted = false;
async function loadHome() {
  if (homeStarted) return;
  homeStarted = true;
  store.set(loadingAtom, true);
  const results = await Promise.all(SECTION_ORDER.map((k) => fetchSection(k)));
  const sections = SECTION_ORDER.map((key, i) => ({ key, assets: results[i] }));
  store.set(sectionsAtom, sections);
  store.set(loadingAtom, false);
  const symbols = new Set<string>(WATCHLIST_SYMBOLS);
  sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
  ensureTicker([...symbols]);
}

const detailStarted = new Set<string>();
async function loadDetail(symbol: string) {
  if (detailStarted.has(symbol)) return;
  detailStarted.add(symbol);
  const d = await fetchAssetDetail(symbol);
  if (d) {
    store.set(detailsAtom, { ...store.get(detailsAtom), [symbol]: d });
    ensureTicker([symbol]);
  }
}

export const jotaiLayer: DataLayer = {
  id: 'jotai',
  label: 'Jotai',
  Provider,

  useHome() {
    const sections = useAtomValue(sectionsAtom);
    const loading = useAtomValue(loadingAtom);
    return { sections, loading };
  },

  prefetchHome() {
    void loadHome();
  },

  useAccount() {
    return useAtomValue(accountAtom);
  },

  useAssetDetail(symbol: string) {
    useEffect(() => {
      void loadDetail(symbol);
    }, [symbol]);
    const details = useAtomValue(detailsAtom);
    const detail = details[symbol] ?? null;
    return { detail, loading: detail == null };
  },

  useWatchlist() {
    const watchlist = useAtomValue(watchlistAtom);
    const setWatchlist = useSetAtom(watchlistAtom);
    const isWatched = useCallback((uuid: string) => uuid in watchlist, [watchlist]);
    const watchedAssets = Object.values(watchlist);
    const toggle = useCallback(
      (asset: Asset) => {
        setWatchlist((prev) => {
          const next = { ...prev };
          if (asset.uuid in next) delete next[asset.uuid];
          else next[asset.uuid] = asset;
          return next;
        });
      },
      [setWatchlist],
    );
    return { isWatched, watchedAssets, toggle };
  },

  useAuth() {
    const account = useAtomValue(accountAtom);
    const setAccount = useSetAtom(accountAtom);
    const signIn = useCallback(
      () => setAccount({ signedIn: true, totalUsd: MOCK_BALANCE_USD, currency: MOCK_CURRENCY }),
      [setAccount],
    );
    const signOut = useCallback(
      () => setAccount({ signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY }),
      [setAccount],
    );
    return { signedIn: account.signedIn, signIn, signOut };
  },

  useLivePrice(symbol: string, fallback: number) {
    const pAtom = priceAtomFor(symbol, fallback);
    const setPrice = useSetAtom(pAtom);
    useEffect(() => {
      return subLive(() => {
        const p = getLivePrice(symbol);
        if (p != null) setPrice(p);
      });
    }, [setPrice, symbol]);
    return useAtomValue(pAtom);
  },
};
