/**
 * TANSTACK QUERY variant. Home sections + asset detail flow through a
 * QueryClient (useQuery), with structuralSharing on (default) — the deep-compare
 * that runs on every refetch. Live prices are pushed into the query cache via
 * setQueryData so the ticking UI also exercises the cache/observer path.
 * Watchlist + auth are small useState-backed contexts (app-local, same for all).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { fetchAssetDetail, fetchSection, WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, Section } from '../types';
import { useSyncExternalStore } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      retry: 0,
      refetchOnMount: true,
    },
  },
});

function Provider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ---- app-local state shared across the tree (auth + watchlist) ----
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

export const tanstackLayer: DataLayer = {
  id: 'tanstack',
  label: 'TanStack Query',
  Provider,

  useHome() {
    const query = useQuery({
      queryKey: ['home'],
      queryFn: async (): Promise<Section[]> => {
        const results = await Promise.all(SECTION_ORDER.map((k) => fetchSection(k)));
        const sections = SECTION_ORDER.map((key, i) => ({ key, assets: results[i] }));
        const symbols = new Set<string>(WATCHLIST_SYMBOLS);
        sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
        ensureTicker([...symbols]);
        return sections;
      },
    });
    return { sections: query.data ?? [], loading: query.isLoading };
  },

  useAccount() {
    return useSyncExternalStore(subLocal, () => account, () => account);
  },

  useAssetDetail(symbol: string) {
    const query = useQuery({
      queryKey: ['detail', symbol],
      queryFn: async () => {
        const d = await fetchAssetDetail(symbol);
        ensureTicker([symbol]);
        return d;
      },
    });
    return { detail: query.data ?? null, loading: query.isLoading };
  },

  useWatchlist() {
    const wl = useSyncExternalStore(subLocal, () => watchlist, () => watchlist);
    const isWatched = useCallback((uuid: string) => uuid in wl, [wl]);
    const watchedAssets = useMemo(() => Object.values(wl), [wl]);
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
    const qc = useQueryClient();
    // Bridge WS ticks into the query cache so the ticking UI exercises TanStack.
    useEffect(() => {
      return subLive(() => {
        const p = getLivePrice(symbol);
        if (p != null) qc.setQueryData(['price', symbol], p);
      });
    }, [qc, symbol]);
    const q = useQuery({
      queryKey: ['price', symbol],
      queryFn: () => getLivePrice(symbol) ?? fallback,
      staleTime: Infinity,
      initialData: fallback,
    });
    return q.data ?? fallback;
  },
};
