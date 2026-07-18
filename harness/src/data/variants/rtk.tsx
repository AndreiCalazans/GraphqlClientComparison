/**
 * REDUX TOOLKIT variant — RTK Query for data fetching + a normal slice for
 * app-local auth/watchlist. RTK Query builds a normalized cache, generates
 * hooks, and runs its reducer/middleware on every dispatch (including the live
 * price updates we push through updateQueryData). This exercises the full
 * Redux store + Immer + reselect path the library imposes.
 */
import { useCallback } from 'react';
import {
  configureStore,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';

import { fetchAssetDetail, fetchSection, WATCHLIST_SYMBOLS } from '../api';
import type { DataLayer } from '../contract';
import { ensureTicker, getLivePrice, subscribe as subLive } from '../liveTicker';
import { MOCK_BALANCE_USD, MOCK_CURRENCY } from '../mockAuth';
import { SECTION_ORDER } from '../types';
import type { Account, Asset, AssetDetail, Section } from '../types';

// ---- RTK Query API ----
const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    home: builder.query<Section[], void>({
      queryFn: async () => {
        const results = await Promise.all(SECTION_ORDER.map((k) => fetchSection(k)));
        const sections = SECTION_ORDER.map((key, i) => ({ key, assets: results[i] }));
        const symbols = new Set<string>(WATCHLIST_SYMBOLS);
        sections.forEach((s) => s.assets.forEach((a) => symbols.add(a.symbol)));
        ensureTicker([...symbols]);
        return { data: sections };
      },
    }),
    detail: builder.query<AssetDetail | null, string>({
      queryFn: async (symbol) => {
        const d = await fetchAssetDetail(symbol);
        ensureTicker([symbol]);
        return { data: d };
      },
    }),
    price: builder.query<number, { symbol: string; fallback: number }>({
      queryFn: ({ symbol, fallback }) => ({ data: getLivePrice(symbol) ?? fallback }),
    }),
  }),
});

// ---- app-local slice (auth + watchlist) ----
type LocalState = { account: Account; watchlist: Record<string, Asset> };
const initialLocal: LocalState = {
  account: { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY },
  watchlist: {},
};
const localSlice = createSlice({
  name: 'local',
  initialState: initialLocal,
  reducers: {
    signIn(state) {
      state.account = { signedIn: true, totalUsd: MOCK_BALANCE_USD, currency: MOCK_CURRENCY };
    },
    signOut(state) {
      state.account = { signedIn: false, totalUsd: 0, currency: MOCK_CURRENCY };
    },
    toggleWatch(state, action: PayloadAction<Asset>) {
      const a = action.payload;
      if (a.uuid in state.watchlist) delete state.watchlist[a.uuid];
      else state.watchlist[a.uuid] = a;
    },
  },
});

const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    local: localSlice.reducer,
  },
  middleware: (gDM) => gDM().concat(api.middleware),
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;
function useAppDispatch(): AppDispatch {
  return useDispatch<AppDispatch>();
}

function Provider({ children }: { children: React.ReactNode }) {
  return <ReduxProvider store={store}>{children}</ReduxProvider>;
}

export const rtkLayer: DataLayer = {
  id: 'rtk',
  label: 'Redux Toolkit',
  Provider,

  useHome() {
    const { data, isLoading } = api.useHomeQuery();
    return { sections: data ?? [], loading: isLoading };
  },

  useAccount() {
    return useSelector((s: RootState) => s.local.account);
  },

  useAssetDetail(symbol: string) {
    const { data, isLoading } = api.useDetailQuery(symbol);
    return { detail: data ?? null, loading: isLoading };
  },

  useWatchlist() {
    const dispatch = useAppDispatch();
    const watchlist = useSelector((s: RootState) => s.local.watchlist);
    const isWatched = useCallback((uuid: string) => uuid in watchlist, [watchlist]);
    const watchedAssets = Object.values(watchlist);
    const toggle = useCallback((asset: Asset) => dispatch(localSlice.actions.toggleWatch(asset)), [dispatch]);
    return { isWatched, watchedAssets, toggle };
  },

  useAuth() {
    const dispatch = useAppDispatch();
    const signedIn = useSelector((s: RootState) => s.local.account.signedIn);
    const signIn = useCallback(() => dispatch(localSlice.actions.signIn()), [dispatch]);
    const signOut = useCallback(() => dispatch(localSlice.actions.signOut()), [dispatch]);
    return { signedIn, signIn, signOut };
  },

  useLivePrice(symbol: string, fallback: number) {
    const dispatch = useAppDispatch();
    const { data } = api.usePriceQuery({ symbol, fallback });
    // Push WS ticks into the RTK Query cache (reducer + Immer produce on each).
    useEffect(() => {
      return subLive(() => {
        const p = getLivePrice(symbol);
        if (p != null) {
          dispatch(
            api.util.updateQueryData('price', { symbol, fallback }, () => p),
          );
        }
      });
    }, [dispatch, symbol, fallback]);
    return data ?? fallback;
  },
};
