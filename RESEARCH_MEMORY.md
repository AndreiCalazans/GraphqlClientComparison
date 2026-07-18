# Research Memory — GraphQL Client Performance Comparison

> Living document. Updated continuously. Goal (README): measure the JS-CPU /
> memory / FPS cost of different GraphQL/data-layer clients in a React Native app
> on a **low-end Samsung device**, using Coinbase's public GraphQL APIs.

## The question
For a RN app that talks to Coinbase's GraphQL API, how much does the choice of
data layer cost in client-side performance (JS CPU, memory, FPS)?

## Data-layer solutions to compare (latest versions)
1. **Relay**
2. **TanStack Query**
3. **Redux Toolkit** (RTK Query)
4. **Vanilla JS** (plain fetch + module state / useSyncExternalStore)
5. **Pure Zustand**
6. **Pure Jotai**

All must render the **identical UI/UX** and exercise identical scenarios.

## Scenarios (all solutions)
- Signed-in: Home shows total user balance (hidden if signed out).
- Home renders 5 sections, each 4 items: Watchlist, TOP_GAINERS, TOP_LOSERS,
  TOP_MOVERS, RECENTLY_LISTED.
- Asset detail screen (description, buy/sell volume, market cap, price changes).
- Asset screen add/remove from watchlist.
- Live price updates of all shown data.
- Sign in experience.

## e2e tests (Maestro-driven, each captures Flashlight + Hermes CPU sample)
1. Open app → tap first asset in TOP_GAINERS → wait to load → back to home.
2. Open app → scroll to bottom → tap last asset available.
3. (AUTHED) Open app → tap first TOP_LOSERS asset → add to watchlist → back →
   confirm in watchlist → tap again → unwatch → back → confirm empty.

## Measurement requirements
1. Identical UI/UX across variants.
2. Maestro CLI drives the e2e.
3. Flashlight (bamlab) → memory + FPS, JSON per run.
4. HermesSamplingProfiler → CPU samples per run (react-native-release-profiler).
5. Maestro captures video of each run.

## Coinbase public GraphQL API — VERIFIED WORKING
- Endpoint: `https://graphql.coinbase.com/query` (POST, `Content-Type: application/json`).
- Public (no auth) queries confirmed working:
  - Section lists: `searchAssetsV2(filter: <FILTER>, first: 4) { edges { node {
    name uuid displaySymbol imageUrl color latestPrice(quoteCurrency:"USD") {
    price percentChanges { hour day } } } } }`
    - Filters (enum `AssetSearchFilter`): `TOP_GAINERS`, `TOP_LOSERS`,
      `TOP_MOVERS`, `RECENTLY_LISTED`, `ALL`, `LISTED`. (Watchlist section uses a
      curated static list of symbols since there's no public "watchlist" query.)
  - Asset detail: `assetBySymbol(symbol:"BTC") { name displaySymbol imageUrl
    color descriptionV2(locale:"en") marketCapV2(quoteCurrency:"USD")
    volume24hV2(quoteCurrency:"USD") volumePercentChange24hV2(quoteCurrency:"USD")
    latestPrice(quoteCurrency:"USD") { price percentChanges { hour day week
    month year } } }`
- Introspection is DISABLED on the public endpoint (use schema.graphql in
  ~/coinbase/mobile_two for schema exploration).
- Live prices: Coinbase exchange WS `wss://ws-feed.exchange.coinbase.com`,
  ticker channel (see mobile_two rewrite/liveTicker.ts). Coalesce flush ~250ms.
- Authed account balance: `viewer { accountsV2(first:100) { edges { node {
  totalBalanceInNativeCurrency { value currency } ... } } } }` via bearer token.
  For the harness we DON'T have production auth; sign-in/balance handled via a
  mock/simple auth toggle so the "authed" scenario is comparable (see decisions).

## Reference materials studied
- `~/coinbase/mobile_two` branch `rewrite/native-first-validation`
  `src/packages/app/src/rewrite/*` — GQL fetch (rewriteGql.ts), liveTicker.ts,
  rewriteRealAccount.ts, bench/ (RQ vs vanilla data-layer micro-bench).
- `~/dev/react-native-animation-performance` — Expo SDK57/RN0.86 harness, native
  frame-rate-monitor module, `scripts/run-test.mjs` orchestrator + `device_sampler.sh`
  (host-side dumpsys PSS + /proc per-thread CPU), Maestro flow generation.
- `~/dev/StateOfReactNativeNavigation/perf-tooling` — Hermes cold-start sampling
  plugin (`withColdStartProfiling.js`), `flashlight-measure.sh`,
  `navigate-profile.sh`, `convert-hermes-profile.js` (cpuprofile→source-mapped).

## Environment
- Host: macOS, Node 24.15 (mise), npm 11.12.
- Device: physical `RX8Y4017Z3Y` = Samsung **SM-A165M (Galaxy A16)** — low-end,
  the intended target. adb connected over USB.
- Maestro 2.6.1. Flashlight installed at ~/.flashlight/bin/flashlight (v from
  get.flashlight.dev). Java 17 (mise). Android SDK ~/Library/Android/sdk.

## Architecture decisions
- **App framework:** Expo SDK 57 / RN 0.86 / React 19, New Arch (Fabric), dev
  build → Gradle release APK. Mirror the animation-perf harness setup.
- **Single app, swappable data layer:** ONE app binary variant per data layer is
  cleanest for isolating cost, BUT rebuilding 6 APKs is heavy. Decision: build
  ONE app that contains all 6 data-layer implementations behind a runtime
  registry + a launch env/deeplink param selecting which one is active. UI
  components are SHARED (identical UI guaranteed). Only the data layer swaps.
  - Rationale: identical UI is a hard requirement; a shared UI + swappable data
    provider makes it structurally identical. Each variant only differs in how it
    fetches/caches/subscribes. Bundle contains all libs but only the selected
    one runs per test (measure active-path CPU, not bundle parse).
  - NOTE on bundle-size fairness: since all libs are bundled, memory baseline
    includes all lib code. We additionally report per-variant DELTA vs the
    vanilla baseline within the same binary (controls for shared overhead).
- **Auth/sign-in:** No production Coinbase auth available in a fresh Expo app.
  Implement a self-contained mock sign-in (email+password screen → sets an
  in-app "signed in" flag + a deterministic mock balance/holdings) so the
  signed-in scenario and the sign-in-experience scenario are identical &
  reproducible across all 6 variants. Live section/asset data stays REAL (public
  GQL). Documented as a limitation.
- **Perf capture:** reuse (a) Flashlight for FPS+RAM JSON, (b) Hermes sampling
  profiler via react-native-release-profiler + withColdStartProfiling plugin for
  CPU cpuprofile, (c) Maestro for driving + video (`--record` / startRecording).
  Also port the native frame-rate-monitor + device_sampler for per-thread JS CPU
  as a cross-check (optional / stretch).

## Plan / progress
- [x] Read README, study all 3 reference projects.
- [x] Verify Coinbase public GQL endpoint + queries (sections, asset detail).
- [x] Install Flashlight; confirm device + Maestro.
- [ ] Scaffold Expo harness app (RN0.86/SDK57), New Arch, Android.
- [ ] Shared UI: Home (5 sections + balance), Asset detail (+watchlist), Sign-in.
- [ ] Data-layer registry + 6 implementations (relay, tanstack, rtk, vanilla,
      zustand, jotai) behind a common interface.
- [ ] Live-price WS layer (shared transport, per-variant subscription glue).
- [ ] Wire Hermes profiler plugin + Flashlight + Maestro flows + video.
- [ ] Build release APK.
- [ ] Write 3 Maestro flows × 6 variants; orchestrator script.
- [ ] Run all, collect Flashlight JSON + Hermes cpuprofiles + videos.
- [ ] Analyze CPU samples; aggregate; write FINDINGS.md.

## Log
- (init) Studied refs; verified public GQL API for all 5 section filters + asset
  detail; introspection disabled (schema.graphql available). Installed Flashlight.
  Device = Galaxy A16 (SM-A165M) low-end. Wrote plan.
