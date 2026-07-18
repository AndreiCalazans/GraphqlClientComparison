# GraphQL Client Performance — Results Summary

Device: Samsung Galaxy A16 (SM-A165M), release build, New Arch (Fabric).
Flashlight metrics are the median across iterations of the Maestro flow.
CPU is % of a single core (can exceed 100 summed across threads).

## T1 — Home → gainer[0] → back

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 24.9 | 55 | 59.9 | 258 | 281 | 7.3 | 24.0 | 23.0 | 50.0 |
| TanStack Query | — | — | — | — | — | — | — | — | — |
| Redux Toolkit | — | — | — | — | — | — | — | — | — |
| Zustand | — | — | — | — | — | — | — | — | — |
| Jotai | — | — | — | — | — | — | — | — | — |
| Relay | — | — | — | — | — | — | — | — | — |

## T2 — Home → scroll → last asset

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 23.4 | 42 | 59.4 | 258 | 279 | 6.8 | 26.4 | 25.2 | 55.6 |
| TanStack Query | — | — | — | — | — | — | — | — | — |
| Redux Toolkit | — | — | — | — | — | — | — | — | — |
| Zustand | — | — | — | — | — | — | — | — | — |
| Jotai | — | — | — | — | — | — | — | — | — |
| Relay | — | — | — | — | — | — | — | — | — |

## T3 — Auth → loser[0] → watch/unwatch

| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vanilla JS | 79.5 | 41 | 59.7 | 259 | 279 | 4.4 | 23.3 | 21.7 | 37.8 |
| TanStack Query | — | — | — | — | — | — | — | — | — |
| Redux Toolkit | — | — | — | — | — | — | — | — | — |
| Zustand | — | — | — | — | — | — | — | — | — |
| Jotai | — | — | — | — | — | — | — | — | — |
| Relay | — | — | — | — | — | — | — | — | — |

## Hermes self-time attributed to the data-layer library (µs, sum across tests)

| Variant | lib self-time (ms) | total sampled (ms) | lib share |
| --- | ---: | ---: | ---: |
| Vanilla JS | 0.0 | 0.0 | 0.00% |
| TanStack Query | 0.0 | 0.0 | 0.00% |
| Redux Toolkit | 0.0 | 0.0 | 0.00% |
| Zustand | 0.0 | 0.0 | 0.00% |
| Jotai | 0.0 | 0.0 | 0.00% |
| Relay | 0.0 | 0.0 | 0.00% |

