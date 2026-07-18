/**
 * Raw Coinbase public GraphQL access + normalization into the shared domain
 * types. This is the ONE place network parsing happens; every data-layer variant
 * calls these same functions, so the only thing that differs between variants is
 * *how* they cache/subscribe/re-render around this data — never the wire format
 * or the parsing cost. That keeps the comparison fair.
 */
import type { Asset, AssetDetail, SectionKey } from './types';

export const GRAPHQL_URL = 'https://graphql.coinbase.com/query';

// The public endpoint has no "watchlist" query, so the Watchlist *section* on
// Home is a curated static universe of well-known symbols. The user's *personal*
// watchlist (add/remove scenario) is app-local state, layered on top.
export const WATCHLIST_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP'];

const SECTION_FILTER: Record<Exclude<SectionKey, 'WATCHLIST'>, string> = {
  TOP_GAINERS: 'TOP_GAINERS',
  TOP_LOSERS: 'TOP_LOSERS',
  TOP_MOVERS: 'TOP_MOVERS',
  RECENTLY_LISTED: 'RECENTLY_LISTED',
};

type RawNode = {
  name?: string;
  uuid?: string;
  displaySymbol?: string;
  imageUrl?: string;
  color?: string;
  latestPrice?: {
    price?: string;
    percentChanges?: { hour?: number; day?: number } | null;
  } | null;
};

function nodeToAsset(n: RawNode): Asset {
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

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

const NODE_FIELDS = `name uuid displaySymbol imageUrl color latestPrice(quoteCurrency: "USD") { price percentChanges { hour day } }`;

/** Fetch 4 assets for a category-backed section (gainers/losers/movers/listed). */
export async function fetchCategorySection(
  filter: Exclude<SectionKey, 'WATCHLIST'>,
): Promise<Asset[]> {
  const q = `query Section { searchAssetsV2(filter: ${SECTION_FILTER[filter]}, first: 4) { edges { node { ${NODE_FIELDS} } } } }`;
  const data = await gql<{ searchAssetsV2?: { edges?: Array<{ node?: RawNode }> } }>(q);
  const edges = data?.searchAssetsV2?.edges ?? [];
  return edges.map((e) => nodeToAsset(e.node ?? {})).slice(0, 4);
}

/** Fetch the curated Watchlist section (4 fixed symbols) via assetBySymbol. */
export async function fetchWatchlistSection(): Promise<Asset[]> {
  const results = await Promise.all(
    WATCHLIST_SYMBOLS.map(async (sym) => {
      const q = `query WL { assetBySymbol(symbol: "${sym}") { ${NODE_FIELDS} } }`;
      const data = await gql<{ assetBySymbol?: RawNode }>(q);
      return data?.assetBySymbol ? nodeToAsset(data.assetBySymbol) : null;
    }),
  );
  return results.filter((a): a is Asset => a != null);
}

/** Fetch one section by key. */
export async function fetchSection(key: SectionKey): Promise<Asset[]> {
  if (key === 'WATCHLIST') return fetchWatchlistSection();
  return fetchCategorySection(key);
}

/** Fetch full asset detail. */
export async function fetchAssetDetail(symbol: string): Promise<AssetDetail | null> {
  const q = `query Detail {
    assetBySymbol(symbol: "${symbol}") {
      name uuid displaySymbol imageUrl color
      descriptionV2(locale: "en")
      marketCapV2(quoteCurrency: "USD")
      volume24hV2(quoteCurrency: "USD")
      volumePercentChange24hV2(quoteCurrency: "USD")
      latestPrice(quoteCurrency: "USD") { price percentChanges { hour day week month year } }
    }
  }`;
  type Raw = {
    assetBySymbol?: {
      name?: string;
      uuid?: string;
      displaySymbol?: string;
      imageUrl?: string;
      color?: string;
      descriptionV2?: string;
      marketCapV2?: string;
      volume24hV2?: string;
      volumePercentChange24hV2?: number;
      latestPrice?: {
        price?: string;
        percentChanges?: {
          hour?: number;
          day?: number;
          week?: number;
          month?: number;
          year?: number;
        };
      } | null;
    } | null;
  };
  const data = await gql<Raw>(q);
  const a = data?.assetBySymbol;
  if (!a) return null;
  const pc = a.latestPrice?.percentChanges ?? {};
  return {
    uuid: a.uuid ?? '',
    symbol: a.displaySymbol ?? symbol,
    name: a.name ?? '',
    imageUrl: a.imageUrl ?? '',
    color: a.color ?? '#0052FF',
    description: a.descriptionV2 ?? '',
    price: Number(a.latestPrice?.price ?? 0),
    marketCap: Number(a.marketCapV2 ?? 0),
    volume24h: Number(a.volume24hV2 ?? 0),
    volumePercentChange24h: Number(a.volumePercentChange24h ?? a.volumePercentChange24hV2 ?? 0),
    changes: {
      hour: Number(pc.hour ?? 0),
      day: Number(pc.day ?? 0),
      week: Number(pc.week ?? 0),
      month: Number(pc.month ?? 0),
      year: Number(pc.year ?? 0),
    },
  };
}
