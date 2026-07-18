/**
 * Relay Environment — the normalized store + network layer. This is the heavy
 * machinery Relay brings: a normalized record source, a store with GC, and a
 * network that writes responses into the store. Every query response is
 * normalized against the compiled artifacts; live prices are written with
 * commitLocalUpdate so ticking also exercises the store + subscriptions.
 */
import {
  Environment,
  Network,
  RecordSource,
  Store,
  type FetchFunction,
} from 'relay-runtime';

import { GRAPHQL_URL } from '../data/api';

const fetchFn: FetchFunction = async (request, variables) => {
  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: request.text, variables }),
  });
  return resp.json();
};

let env: Environment | null = null;

export function getRelayEnvironment(): Environment {
  if (env) return env;
  env = new Environment({
    network: Network.create(fetchFn),
    store: new Store(new RecordSource()),
  });
  return env;
}
