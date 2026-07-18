/**
 * Data-layer registry + active-variant selection.
 *
 * The app bundles ALL six implementations but only ONE runs per launch. The
 * active variant is chosen (in priority order) by:
 *   1. an env var baked at build time: EXPO_PUBLIC_DATA_LAYER
 *   2. a deep-link / initialURL query param `?variant=` (set by Maestro)
 *   3. a runtime picker on a dev launch screen
 *   4. default: 'vanilla'
 *
 * Only the selected variant's Provider is mounted and only its hooks run, so we
 * measure the ACTIVE data path's CPU, not all six.
 */
import { createContext, useContext } from 'react';

import type { DataLayer, DataLayerId } from './contract';
import { vanillaLayer } from './variants/vanilla';
import { tanstackLayer } from './variants/tanstack';
import { rtkLayer } from './variants/rtk';
import { zustandLayer } from './variants/zustand';
import { jotaiLayer } from './variants/jotai';
import { relayLayer } from './variants/relay';

export const LAYERS: Record<DataLayerId, DataLayer> = {
  vanilla: vanillaLayer,
  tanstack: tanstackLayer,
  rtk: rtkLayer,
  zustand: zustandLayer,
  jotai: jotaiLayer,
  relay: relayLayer,
};

export const ALL_IDS: DataLayerId[] = [
  'vanilla',
  'tanstack',
  'rtk',
  'zustand',
  'jotai',
  'relay',
];

export function resolveVariantId(initialUrl?: string | null): DataLayerId {
  const env = process.env.EXPO_PUBLIC_DATA_LAYER as DataLayerId | undefined;
  if (env && env in LAYERS) return env;
  if (initialUrl) {
    const m = initialUrl.match(/[?&]variant=([a-z]+)/i);
    if (m && (m[1] as DataLayerId) in LAYERS) return m[1] as DataLayerId;
  }
  return 'vanilla';
}

const DataLayerContext = createContext<DataLayer>(vanillaLayer);

export function DataLayerProvider({
  layer,
  children,
}: {
  layer: DataLayer;
  children: React.ReactNode;
}) {
  const Inner = layer.Provider ?? PassThrough;
  return (
    <DataLayerContext.Provider value={layer}>
      <Inner>{children}</Inner>
    </DataLayerContext.Provider>
  );
}

function PassThrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useDataLayer(): DataLayer {
  return useContext(DataLayerContext);
}
