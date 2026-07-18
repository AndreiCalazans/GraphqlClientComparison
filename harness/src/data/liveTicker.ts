/**
 * Shared live-price transport: ONE Coinbase exchange WebSocket, ticker channel,
 * coalesced to a ~250ms flush so a burst of ticks doesn't thrash React. This is
 * the SAME transport for every variant (adapted from mobile_two rewrite/
 * liveTicker.ts) — variants differ only in how they *subscribe* their store to
 * it, not in the socket cost. Prices are keyed by base symbol (e.g. "BTC").
 */
const WS_URL = 'wss://ws-feed.exchange.coinbase.com';
const FLUSH_MS = 250;

const prices = new Map<string, number>();
const listeners = new Set<() => void>();
let ws: WebSocket | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let version = 0;
const subscribed = new Set<string>();

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) {
      dirty = false;
      version += 1;
      listeners.forEach((l) => l());
    }
  }, FLUSH_MS);
}

function productIdsFor(symbols: string[]): string[] {
  return symbols.map((s) => `${s}-USD`);
}

/** Ensure the socket is open and subscribed to the given symbols. Idempotent. */
export function ensureTicker(symbols: string[]): void {
  const fresh = symbols.filter((s) => !subscribed.has(s));
  fresh.forEach((s) => subscribed.add(s));

  if (!ws) {
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: productIdsFor([...subscribed]),
            channels: ['ticker'],
          }),
        );
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as {
            type?: string;
            product_id?: string;
            price?: string;
          };
          if (msg.type === 'ticker' && msg.product_id && msg.price) {
            const sym = msg.product_id.replace('-USD', '');
            prices.set(sym, Number(msg.price));
            scheduleFlush();
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        ws = null;
      };
      ws.onerror = () => {};
    } catch {
      ws = null;
    }
  } else if (fresh.length && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        product_ids: productIdsFor(fresh),
        channels: ['ticker'],
      }),
    );
  }
}

export function getLivePrice(symbol: string): number | undefined {
  return prices.get(symbol);
}

export function getVersion(): number {
  return version;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
