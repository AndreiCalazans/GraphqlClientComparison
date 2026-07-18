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
- [x] Scaffold Expo harness app (RN0.86/SDK57), New Arch, Android.
- [x] Shared UI: Home (5 sections + balance), Asset detail (+watchlist), Sign-in.
- [x] Data-layer registry + 6 implementations (relay, tanstack, rtk, vanilla,
      zustand, jotai) behind a common interface. Typecheck clean.
- [x] Live-price WS layer (shared transport, per-variant subscription glue).
- [x] Wire Hermes profiler plugin (copied withColdStartProfiling) + JS-side
      coldStartProfiling scheduler. Variant chosen via EXPO_PUBLIC_DATA_LAYER.
- [x] Build release APK (single binary, all 6 variants, deep-link selection).
- [x] Write 3 Maestro flows × 6 variants (gen-flows.mjs); orchestrator
      (run-one.mjs / run-all.mjs). Fixed cold-start variant selection
      (clearState + stopApp + openLink; a plain launchApp booted the default).
- [x] Run all 6×3=18 cases (3 Maestro iters each): Flashlight JSON + source-
      mapped Hermes cpuprofiles + videos in results/<variant>__<test>/.
- [x] Analyze: aggregate.mjs (Flashlight FPS/RAM/JS-CPU + Hermes self-time by
      node_module) -> results/SUMMARY.md + summary.json. Wrote FINDINGS.md,
      updated README with the answer.

## RESULT (see FINDINGS.md)
- Data layer is NOT an FPS (all ~60) or RAM (~254-261MB band) differentiator on
  the A16. It's a JS-thread CPU cost, proportional to per-write work.
- JS-CPU ordering (Flashlight mqt_v_js delta vs vanilla AND Hermes lib self-time
  agree): RTK > TanStack ~ Relay > Zustand ~ Jotai ~ Vanilla.
- Hermes lib self-time (sum t1-t3): RTK 1606ms (immer+reduxjs+reselect),
  TanStack 425ms, Relay 308ms, Zustand 33ms, Jotai 18ms, Vanilla 0.
- Trap: routing live-price ticks through Immer/reselect (RTK) or deep structural
  sharing (TanStack) recurs per tick. Keep hot data on a light external store.
- Hermes profiler enabled in MainApplication.onCreate -> captures from first
  bundle module load (early frames present; confirmed span 20.2s from
  setUpDefaultReactNativeEnvironment/metroRequire).

## BLOG POST
- Wrote ~/dev/andrei-calazans-blog post
  src/content/post/2026-07-18-cost-of-graphql-client-server-state/index.md
  "What Does a GraphQL / Server-State Client Cost You Per Request?"
- Framing: cost-per-network-request of server-state mgmt; contrast full clients
  (Relay/TanStack/RTK) vs barebones (Vanilla/Zustand/Jotai) + what features you
  pay for. Embedded: T3 demo video (public/videos/gql-client-demo.mp4, ffmpeg
  1.6x speed, 484KB) + 2 Hermes flamegraph PNGs (RTK vs Zustand active-JS).
- Flamegraphs generated by scripts/flamegraph.mjs (icicle SVG from B/E trace,
  --active drops idle, --maxdepth caps rows, --lib highlights lib node_modules),
  rasterized via Chrome headless --screenshot (note: Chrome may not self-exit;
  wrap in `timeout`, PNG is written before it hangs).
- Blog `pnpm build` passes; images -> optimized webp, video ref present.

## FOLLOW-UP (reviewer feedback)
- BUG the reviewer caught: the Hermes profiler stopped on a fixed 20s timeout,
  truncating the long T3 flow (~80s) -> we lost most of T3's samples.
- FIX: replaced timeout with a UI stop-profiler button (ProfilerControl.tsx,
  perf/coldStartProfiling.ts stopProfiler()). Maestro flow taps btn-stop-profiler
  at the end of each test and asserts `profiler-done` (flips only after
  stopProfiling(true) resolves + file on disk; native toast follows ~1s). Host
  pulls a fully-written file. run-one.mjs screenrecord --time-limit bumped 60->180.
- Re-ran full 6x3 matrix. T3 profiles now span 70-100s (was 20s); RTK t3 has
  10368 events (was truncated). Library self-times ~2x higher & cleaner:
  RTK 3218ms (immer 702 + reduxjs 629 + redux 341 + reselect 221, mostly in T3
  from per-live-tick store writes), TanStack 904, Relay 804, Zustand 277,
  Jotai 122, Vanilla 0. Ordering unchanged, now clearer.
- ADDED FPS caveat (reviewer point): FPS flat ~60 ONLY because this app is
  lightweight/JS-idle. In a busy app a saturated JS thread -> unresponsive app;
  JS-CPU cost is the real-world predictor, not demo FPS. Documented in
  FINDINGS.md + README.
- Hermes self-time is now the PRIMARY metric (full-window, isolates library);
  Flashlight whole-flow JS-CPU avg is noisier (idle waits dilute bursts) ->
  demoted to corroborating.

## Log
- (init) Studied refs; verified public GQL API for all 5 section filters + asset
  detail; introspection disabled (schema.graphql available). Installed Flashlight.
  Device = Galaxy A16 (SM-A165M) low-end. Wrote plan.
