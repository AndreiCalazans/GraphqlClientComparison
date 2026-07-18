#!/usr/bin/env node
/**
 * Aggregate all results/<variant>__<test>/ into a single summary:
 *   - Flashlight: median FPS, avg/max RAM (MB), avg/max JS-thread CPU (mqt_v_js),
 *     avg UI-thread CPU, total-process CPU, flow duration.
 *   - Hermes: total self-time attributed to library frames (per variant) as a
 *     proxy for the data-layer's JS-CPU footprint.
 *
 * Writes results/summary.json + results/SUMMARY.md.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = resolve(ROOT, 'results');

const VARIANTS = ['vanilla', 'tanstack', 'rtk', 'zustand', 'jotai', 'relay'];
const LABEL = {
  vanilla: 'Vanilla JS',
  tanstack: 'TanStack Query',
  rtk: 'Redux Toolkit',
  zustand: 'Zustand',
  jotai: 'Jotai',
  relay: 'Relay',
};
const TESTS = ['t1', 't2', 't3'];
const TEST_NAME = {
  t1: 'Home → gainer[0] → back',
  t2: 'Home → scroll → last asset',
  t3: 'Auth → loser[0] → watch/unwatch',
};

// node_module names that belong to each variant's data-layer library. The
// Hermes sampler tags every frame with args.node_module, so self-time can be
// attributed to the library precisely.
const LIB_MODULES = {
  tanstack: ['@tanstack'],
  rtk: ['@reduxjs', 'react-redux', 'immer', 'reselect', 'redux'],
  zustand: ['zustand'],
  jotai: ['jotai'],
  relay: ['relay-runtime', 'react-relay'],
  vanilla: [],
};

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(xs) {
  return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null;
}
function max(xs) {
  return xs.length ? Math.max(...xs) : null;
}

function summarizeFlashlight(file) {
  if (!existsSync(file)) return null;
  let d;
  try {
    d = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const iters = (d.iterations || []).filter((it) => it.status === 'SUCCESS');
  if (!iters.length) return null;

  // Per-iteration aggregates, then median across iterations.
  const perIter = iters.map((it) => {
    const measures = it.measures || [];
    const fps = measures.map((m) => m.fps).filter((v) => v != null);
    const ram = measures.map((m) => m.ram).filter((v) => v != null);
    const jsCpu = measures.map((m) => m.cpu?.perName?.['mqt_v_js'] ?? 0);
    const uiCpu = measures.map((m) => m.cpu?.perName?.['UI Thread'] ?? 0);
    const renderCpu = measures.map((m) => m.cpu?.perName?.['RenderThread'] ?? 0);
    const totalCpu = measures.map((m) => {
      const per = m.cpu?.perName ?? {};
      return Object.values(per).reduce((a, c) => a + (Number(c) || 0), 0);
    });
    return {
      durationMs: it.time,
      fpsMin: fps.length ? Math.min(...fps) : null,
      fpsMean: mean(fps),
      ramMean: mean(ram),
      ramMax: max(ram),
      jsCpuMean: mean(jsCpu),
      jsCpuMax: max(jsCpu),
      uiCpuMean: mean(uiCpu),
      renderCpuMean: mean(renderCpu),
      totalCpuMean: mean(totalCpu),
    };
  });

  const pick = (k) => median(perIter.map((p) => p[k]).filter((v) => v != null));
  return {
    iterations: perIter.length,
    durationMs: pick('durationMs'),
    fpsMin: pick('fpsMin'),
    fpsMean: pick('fpsMean'),
    ramMean: pick('ramMean'),
    ramMax: pick('ramMax'),
    jsCpuMean: pick('jsCpuMean'),
    jsCpuMax: pick('jsCpuMax'),
    uiCpuMean: pick('uiCpuMean'),
    renderCpuMean: pick('renderCpuMean'),
    totalCpuMean: pick('totalCpuMean'),
  };
}

/**
 * From the source-mapped Hermes chrome-trace (B/E phase events), reconstruct
 * per-frame SELF time by walking the call stack: at any instant the top frame
 * on the stack accrues wall time. We then sum self-time by node_module and
 * attribute the variant's library modules. Returns µs (self) for the library,
 * total sampled JS self-time, and a breakdown of the biggest modules.
 */
function summarizeHermes(file, variant) {
  if (!existsSync(file)) return null;
  let events;
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'));
    events = Array.isArray(d) ? d : d.traceEvents || [];
  } catch {
    return null;
  }
  // Only B/E events, sorted by ts, grouped per thread (tid).
  const be = events
    .filter((e) => e.ph === 'B' || e.ph === 'E')
    .sort((a, b) => a.ts - b.ts);
  const selfByModule = {};
  const stacks = {}; // tid -> array of {mod, ts}
  let prevTs = null;
  // Accrue elapsed time to the current top-of-stack frame across ALL threads.
  // Since Hermes samples one JS thread, treat the union timeline.
  for (let i = 0; i < be.length; i++) {
    const e = be[i];
    const tid = e.tid ?? 0;
    if (prevTs != null) {
      const dt = e.ts - prevTs;
      if (dt > 0) {
        // charge dt to the current top frame of the thread that was executing
        const st = stacks[tid] || [];
        const top = st[st.length - 1];
        const mod = top ? top.mod : '(idle)';
        selfByModule[mod] = (selfByModule[mod] || 0) + dt;
      }
    }
    if (!stacks[tid]) stacks[tid] = [];
    if (e.ph === 'B') {
      stacks[tid].push({ mod: e.args?.node_module || '(unknown)', ts: e.ts });
    } else {
      stacks[tid].pop();
    }
    prevTs = e.ts;
  }
  const libMods = LIB_MODULES[variant] || [];
  let libSelfUs = 0;
  let totalUs = 0;
  for (const [mod, us] of Object.entries(selfByModule)) {
    if (mod === '(idle)') continue;
    totalUs += us;
    if (libMods.some((m) => mod === m || mod.startsWith(m + '/'))) libSelfUs += us;
  }
  const top = Object.entries(selfByModule)
    .filter(([m]) => m !== '(idle)')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([m, us]) => ({ module: m, ms: +(us / 1000).toFixed(1) }));
  return { libSelfUs, totalUs, events: events.length, topModules: top };
}

const summary = {};
for (const variant of VARIANTS) {
  summary[variant] = {};
  for (const test of TESTS) {
    const dir = resolve(RES, `${variant}__${test}`);
    summary[variant][test] = {
      flashlight: summarizeFlashlight(resolve(dir, 'flashlight.json')),
      hermes: summarizeHermes(resolve(dir, 'hermes.json'), variant),
    };
  }
}

writeFileSync(resolve(RES, 'summary.json'), JSON.stringify(summary, null, 2));

// ---- markdown ----
function fmt(v, d = 1) {
  return v == null ? 'n/a' : Number(v).toFixed(d);
}
let md = `# GraphQL Client Performance — Results Summary\n\n`;
md += `Device: Samsung Galaxy A16 (SM-A165M), release build, New Arch (Fabric).\n`;
md += `Flashlight metrics are the median across iterations of the Maestro flow.\n`;
md += `CPU is % of a single core (can exceed 100 summed across threads).\n\n`;

for (const test of TESTS) {
  md += `## ${test.toUpperCase()} — ${TEST_NAME[test]}\n\n`;
  md += `| Variant | Dur (s) | FPS min | FPS avg | RAM avg (MB) | RAM max (MB) | JS CPU avg% | JS CPU max% | UI CPU avg% | Total CPU avg% |\n`;
  md += `| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const variant of VARIANTS) {
    const f = summary[variant][test]?.flashlight;
    if (!f) {
      md += `| ${LABEL[variant]} | — | — | — | — | — | — | — | — | — |\n`;
      continue;
    }
    md += `| ${LABEL[variant]} | ${fmt(f.durationMs / 1000, 1)} | ${fmt(f.fpsMin, 0)} | ${fmt(f.fpsMean, 1)} | ${fmt(f.ramMean, 0)} | ${fmt(f.ramMax, 0)} | ${fmt(f.jsCpuMean, 1)} | ${fmt(f.jsCpuMax, 1)} | ${fmt(f.uiCpuMean, 1)} | ${fmt(f.totalCpuMean, 1)} |\n`;
  }
  md += `\n`;
}

md += `## Hermes self-time attributed to the data-layer library (µs, sum across tests)\n\n`;
md += `| Variant | lib self-time (ms) | total sampled (ms) | lib share |\n`;
md += `| --- | ---: | ---: | ---: |\n`;
for (const variant of VARIANTS) {
  let lib = 0;
  let total = 0;
  for (const test of TESTS) {
    const h = summary[variant][test]?.hermes;
    if (h) {
      lib += h.libSelfUs;
      total += h.totalUs;
    }
  }
  const share = total > 0 ? (lib / total) * 100 : 0;
  md += `| ${LABEL[variant]} | ${fmt(lib / 1000, 1)} | ${fmt(total / 1000, 1)} | ${fmt(share, 2)}% |\n`;
}
md += `\n`;

writeFileSync(resolve(RES, 'SUMMARY.md'), md);
console.log('wrote results/summary.json + results/SUMMARY.md');
console.log(md);
