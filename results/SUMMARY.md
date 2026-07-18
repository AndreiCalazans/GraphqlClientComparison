# GraphQL Client Performance — Results Summary

Device: Samsung Galaxy A16 (SM-A165M), release build, New Arch (Fabric).
Flashlight metrics are the median across iterations of the Maestro flow.
CPU is % of a single core (can exceed 100 summed across threads).

## T1 — Home → gainer[0] → back

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 23.6 | 53 | 59.8 | 254 | 278 | 6.2 | 26.4 | 24.7 | 49.4 |
| TanStack Query | 17.8 | 56 | 59.8 | 256 | 282 | 8.8 | 29.7 | 22.4 | 52.9 |
| Redux Toolkit | 24.3 | 47 | 59.7 | 257 | 279 | 11.3 | 33.9 | 24.0 | 55.3 |
| Zustand | 13.6 | 56 | 59.9 | 249 | 276 | 7.7 | 25.9 | 23.1 | 58.1 |
| Jotai | 20.5 | 57 | 59.9 | 256 | 281 | 8.4 | 25.6 | 24.8 | 55.0 |
| Relay | 25.1 | 54 | 59.8 | 255 | 278 | 10.2 | 30.2 | 24.1 | 51.1 |

## T2 — Home → scroll → last asset

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 24.6 | 42 | 59.1 | 264 | 281 | 7.0 | 25.8 | 23.6 | 52.5 |
| TanStack Query | 22.9 | 46 | 59.3 | 261 | 280 | 8.0 | 23.8 | 23.6 | 56.2 |
| Redux Toolkit | 22.2 | 44 | 59.3 | 263 | 282 | 9.7 | 27.7 | 24.8 | 61.1 |
| Zustand | 22.6 | 47 | 59.4 | 258 | 277 | 7.4 | 25.9 | 23.4 | 56.3 |
| Jotai | 20.3 | 47 | 59.3 | 254 | 273 | 6.6 | 25.9 | 25.3 | 57.4 |
| Relay | 26.8 | 41 | 59.3 | 260 | 277 | 9.0 | 30.7 | 25.2 | 54.9 |

## T3 — Auth → loser[0] → watch/unwatch

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 77.9 | 45 | 59.8 | 261 | 281 | 4.3 | 26.0 | 21.7 | 38.5 |
| TanStack Query | 74.7 | 45 | 59.8 | 257 | 277 | 4.8 | 25.4 | 22.4 | 40.4 |
| Redux Toolkit | 80.9 | 42 | 59.8 | 262 | 278 | 5.8 | 35.8 | 22.2 | 39.6 |
| Zustand | 84.3 | 42 | 59.8 | 256 | 274 | 4.4 | 25.9 | 22.6 | 39.2 |
| Jotai | 75.8 | 42 | 59.7 | 264 | 284 | 4.5 | 27.6 | 22.0 | 38.9 |
| Relay | 81.7 | 47 | 59.8 | 258 | 277 | 5.2 | 30.2 | 21.6 | 38.3 |

## Hermes self-time attributed to the data-layer library (µs, sum across tests)

| Variant | lib self-time (ms) | total sampled (ms) | lib share |
| --- | ---: | ---: | ---: |
| Vanilla JS | 0.0 | 60534.7 | 0.00% |
| TanStack Query | 425.3 | 60687.2 | 0.70% |
| Redux Toolkit | 1606.4 | 60679.4 | 2.65% |
| Zustand | 33.4 | 60650.2 | 0.06% |
| Jotai | 17.7 | 60852.9 | 0.03% |
| Relay | 307.6 | 60711.3 | 0.51% |

