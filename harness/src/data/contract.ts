/**
 * The contract every data-layer variant must satisfy. The UI is written ONLY
 * against these hooks, so swapping the active variant can never change what is
 * rendered — only the machinery behind it. This is how we guarantee "identical
 * UI/UX" (README requirement #1) while isolating the data-layer cost.
 */
import type { Account, Asset, AssetDetail, Section } from './types';

export type DataLayerId =
  | 'vanilla'
  | 'tanstack'
  | 'rtk'
  | 'zustand'
  | 'jotai'
  | 'relay';

export type DataLayer = {
  id: DataLayerId;
  label: string;

  /** Optional React provider wrapping the whole app (QueryClientProvider, etc). */
  Provider?: React.ComponentType<{ children: React.ReactNode }>;

  /** Home: the 5 sections. Suspends or returns [] until loaded. */
  useHome: () => { sections: Section[]; loading: boolean };

  /** Signed-in account (balance). */
  useAccount: () => Account;

  /** Asset detail by symbol. */
  useAssetDetail: (symbol: string) => { detail: AssetDetail | null; loading: boolean };

  /** Personal watchlist membership + toggle (app-local, per-variant storage). */
  useWatchlist: () => {
    isWatched: (uuid: string) => boolean;
    watchedAssets: Asset[];
    toggle: (asset: Asset) => void;
  };

  /** Auth actions (mock). */
  useAuth: () => {
    signedIn: boolean;
    signIn: (email: string, password: string) => void;
    signOut: () => void;
  };

  /**
   * Live price for a symbol (WS-driven). Returning the live override or the
   * last-known cached price. The UI reads this to show ticking prices.
   */
  useLivePrice: (symbol: string, fallback: number) => number;

  /** Kick off Home data load (called on Home mount). */
  prefetchHome?: () => void;
};
