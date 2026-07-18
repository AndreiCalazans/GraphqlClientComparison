# What's the Cost of a GraphQL Client When Performance Matters?

This repo researches the cost of GraphQL clients and how they can impact client
side performance. We want to make an informed decision of how much certain
features cost for performance in a React Native app against a low end Samsung
device. 

## Answer

See **[FINDINGS.md](./FINDINGS.md)** for the full methodology, data and analysis.

TL;DR (Samsung Galaxy A16, release build, New Arch, median of 3 Maestro runs):
the data layer is **not** an FPS or memory problem (all six held ~60 FPS within a
~7 MB RAM band) — it's a **JS-thread CPU** problem, and the ordering is:

> **Redux Toolkit (RTK Query) > TanStack Query ≈ Relay > Zustand ≈ Jotai ≈ Vanilla**

RTK is the heaviest (Immer produce + reducer + reselect on *every* cache write,
including every live-price tick); TanStack/Relay add moderate normalization/
observer cost; **Zustand and Jotai are within noise of hand-rolled vanilla.** The
biggest trap is routing high-frequency live prices through a heavy store — keep
ticking data on a minimal `useSyncExternalStore`-style channel.

Reproducible harness in `harness/`, Maestro flows in `maestro/`, orchestration in
`scripts/`, raw Flashlight JSON + source-mapped Hermes profiles + videos in
`results/`. Progress log in `RESEARCH_MEMORY.md`.

---


# What to Compare

Using Coinbase's GraphQL public APIs. We will build multiple data layer
solutions and compare their JavaScript CPU cost. 


Data layer solutions to compare:

- Relay
- Tanstack Query
- Redux Tool Kit. 
- Vanilla JS solution
- Pure Zustand
- Pure Jotai

Use latest version of each package.

The Comparable Cases:

All solutions will tested in the following scenarios:

- When signed in Home will display total user balance. If not signed in don't
  display this.
- Home screen that renders 5 sections. Sections are 4 Watchlist items, 4 TOP_GAINERS, 4 TOP_LOSERS, 4 TOP_MOVERS, 4 RECENTLY_LISTED.
- Navigate to an asset screen. On press on asset we view an asset detail with
  description, buy/sell volume, and whatever information available.
- Asset screen will support adding and removing item from watchlist.
- Live price updates of all shown data.
- Sign in experience.

# Requirements of our test

1. The UI and user experience must be identical. 
2. The test will be driven by Maestro CLI program to do the e2e test.
3. Use Flashlight (https://github.com/bamlab/flashlight) to memory and FPS data,
   output as json for each run.
4. Run the HermesSamplingProfiler to capture sampling data so we can later do an
   analysis of the CPU samples.
5. Use Meastro to capture videos of each run



# UI e2e Tests


1. Open the app. Navigate to the first asset in the TOP GAINERS. Wait to load.
   Then navigate back to home.
2. Open the app. Scroll all the way down. Press on the last asset available. 
3. (AUTHED session required). Open the app. Press on the first asset in TOP
   losers. Add to watchlist. Go back. Confirm asset is in our watchlist. Then
   press the asset again. Unwatch. Go back. Confirm watchlist is empty.

Every e2e test captures the Flashlist data plus the Hermes CPU sample.


# Helpers

Use the branch rewrite/native-first-validation in ~/coinbase/mobile_two
(src/packages/app/src/rewrite/RewriteApp.tsx) as an example on how to setup the
GraphQL queries to access the Coinbase APIs.

In ~/dev/StateOfReactNativeNavigation we have a setup for profiling the app with
systrace and hermes sampling profiler. Use only the hermes sampling profiler
since this is only for the JavaScript thread. 

There is an example here https://github.com/cortinico/repro-36296 on how we can
setup Maestro alongside Flashlight.

In ~/dev/react-native-animation-performance/* we have a base React Native setup
that you can replicate.
