# GraphQL Client Performance — Results Summary

Device: Samsung Galaxy A16 (SM-A165M), release build, New Arch (Fabric).
Flashlight metrics are the median across iterations of the Maestro flow.
CPU is % of a single core (can exceed 100 summed across threads).

## T1 — Home → gainer[0] → back

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 37.5 | 55 | 59.9 | 257 | 283 | 8.8 | 37.3 | 24.7 | 50.8 |
| TanStack Query | 34.4 | 49 | 59.8 | 257 | 284 | 9.2 | 37.2 | 26.1 | 53.0 |
| Redux Toolkit | 19.5 | 49 | 59.6 | 264 | 288 | 9.9 | 35.3 | 25.9 | 58.2 |
| Zustand | 30.4 | 50 | 59.8 | 260 | 287 | 9.5 | 36.9 | 25.4 | 54.5 |
| Jotai | 34.0 | 54 | 59.6 | 262 | 290 | 7.4 | 35.8 | 25.2 | 53.3 |
| Relay | 29.0 | 51 | 59.7 | 260 | 284 | 9.7 | 37.7 | 25.5 | 53.2 |

## T2 — Home → scroll → last asset

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 27.4 | 39 | 59.1 | 263 | 280 | 7.6 | 35.6 | 24.6 | 56.5 |
| TanStack Query | 26.0 | 39 | 59.0 | 256 | 292 | 5.7 | 37.8 | 24.2 | 64.8 |
| Redux Toolkit | 21.5 | 38 | 58.7 | 267 | 284 | 9.9 | 35.6 | 24.9 | 59.8 |
| Zustand | 28.2 | 43 | 59.3 | 267 | 287 | 8.6 | 35.2 | 26.0 | 57.5 |
| Jotai | 21.5 | 45 | 59.2 | 266 | 290 | 6.9 | 35.0 | 24.7 | 56.6 |
| Relay | 26.3 | 47 | 59.2 | 259 | 278 | 7.7 | 34.6 | 25.3 | 56.4 |

## T3 — Auth → loser[0] → watch/unwatch

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 107.1 | 43 | 59.8 | 257 | 284 | 9.0 | 35.3 | 23.2 | 47.7 |
| TanStack Query | 89.5 | 43 | 59.7 | 254 | 284 | 7.2 | 38.2 | 22.7 | 47.6 |
| Redux Toolkit | 75.7 | 37 | 59.6 | 262 | 281 | 8.3 | 36.3 | 23.4 | 47.5 |
| Zustand | 95.3 | 45 | 59.8 | 256 | 283 | 8.5 | 37.5 | 23.0 | 47.2 |
| Jotai | 96.9 | 40 | 59.7 | 256 | 279 | 7.0 | 36.8 | 23.5 | 46.3 |
| Relay | 84.3 | 46 | 59.7 | 257 | 279 | 7.9 | 33.1 | 24.3 | 46.5 |

## Hermes self-time attributed to the data-layer library (µs, sum across tests)

| Variant | lib self-time (ms) | total sampled (ms) | lib share |
| --- | ---: | ---: | ---: |
| Vanilla JS | 0.0 | 145618.7 | 0.00% |
| TanStack Query | 903.9 | 120517.1 | 0.75% |
| Redux Toolkit | 3217.8 | 117803.3 | 2.73% |
| Zustand | 277.1 | 152792.4 | 0.18% |
| Jotai | 122.0 | 116875.7 | 0.10% |
| Relay | 804.4 | 130766.7 | 0.62% |

