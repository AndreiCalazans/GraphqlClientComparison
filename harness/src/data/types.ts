/**
 * Shared domain types used by every data-layer variant and every UI component.
 * Keeping these identical guarantees the rendered UI is byte-for-byte the same
 * regardless of which client fetched the data — the whole point of the study.
 */

export type SectionKey =
  | 'WATCHLIST'
  | 'TOP_GAINERS'
  | 'TOP_LOSERS'
  | 'TOP_MOVERS'
  | 'RECENTLY_LISTED';

export const SECTION_ORDER: SectionKey[] = [
  'WATCHLIST',
  'TOP_GAINERS',
  'TOP_LOSERS',
  'TOP_MOVERS',
  'RECENTLY_LISTED',
];

export const SECTION_TITLE: Record<SectionKey, string> = {
  WATCHLIST: 'Watchlist',
  TOP_GAINERS: 'Top gainers',
  TOP_LOSERS: 'Top losers',
  TOP_MOVERS: 'Top movers',
  RECENTLY_LISTED: 'Recently listed',
};

/** One asset row as shown on Home. */
export type Asset = {
  uuid: string;
  symbol: string;
  name: string;
  imageUrl: string;
  color: string;
  price: number;
  changeDay: number; // fraction, e.g. 0.021 = +2.1%
  changeHour: number;
};

/** A home section: title + up to 4 assets. */
export type Section = {
  key: SectionKey;
  assets: Asset[];
};

/** Full asset detail screen payload. */
export type AssetDetail = {
  uuid: string;
  symbol: string;
  name: string;
  imageUrl: string;
  color: string;
  description: string;
  price: number;
  marketCap: number;
  volume24h: number;
  volumePercentChange24h: number;
  changes: {
    hour: number;
    day: number;
    week: number;
    month: number;
    year: number;
  };
};

/** Signed-in account snapshot (mock, deterministic). */
export type Account = {
  signedIn: boolean;
  totalUsd: number;
  currency: string;
};

/** The complete Home payload every variant must produce. */
export type HomeData = {
  sections: Section[];
};
