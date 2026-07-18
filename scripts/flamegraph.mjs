#!/usr/bin/env node
/**
 * Render an icicle flamegraph SVG from a source-mapped Hermes chrome-trace
 * (B/E events) and highlight the data-layer library frames. Aggregates all
 * B/E stacks into a merged tree (self+total per frame), lays it out top-down.
 *
 *   node scripts/flamegraph.mjs <hermes.json> <out.svg> [--title "..."] [--lib @tanstack,immer,...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
const titleFlag = process.argv.indexOf('--title');
const title = titleFlag > 0 ? process.argv[titleFlag + 1] : '';
const libFlag = process.argv.indexOf('--lib');
const LIB = (libFlag > 0 ? process.argv[libFlag + 1] : '').split(',').filter(Boolean);
// When set, drop time where the top-of-stack frame is idle (no JS running) so
// the flamegraph shows ACTIVE JS work, not the network/idle wait.
const ACTIVE_ONLY = process.argv.includes('--active');
const mdFlag = process.argv.indexOf('--maxdepth');
const MAX_DEPTH = mdFlag > 0 ? Number(process.argv[mdFlag + 1]) : Infinity;
const IDLE_NAMES = new Set(['[idle]', '[root]', 'root', '(program)', 'Idle']);

const events = JSON.parse(readFileSync(inPath, 'utf8'));
const be = events.filter((e) => e.ph === 'B' || e.ph === 'E').sort((a, b) => a.ts - b.ts);

// Build a merged call tree. Each node: {name, mod, value(self+desc us), children}
const root = { name: 'root', mod: 'root', value: 0, children: new Map() };
const stackByTid = {};
let prevTs = null;
let prevTid = null;

function charge(us) {
  if (us <= 0) return;
  const st = stackByTid[prevTid];
  if (!st || !st.length) return;
  // Add `us` to every node on the current stack path (total time), by walking
  // the merged tree along the same name path.
  let node = root;
  root.value += us;
  for (const frame of st) {
    let child = node.children.get(frame.key);
    if (!child) {
      child = { name: frame.name, mod: frame.mod, value: 0, children: new Map() };
      node.children.set(frame.key, child);
    }
    child.value += us;
    node = child;
  }
}

function topIsIdle() {
  const st = stackByTid[prevTid];
  if (!st || !st.length) return true;
  const top = st[st.length - 1];
  return IDLE_NAMES.has(top.name) || top.mod === 'root';
}

for (const e of be) {
  const tid = e.tid ?? 0;
  if (prevTs != null && !(ACTIVE_ONLY && topIsIdle())) charge(e.ts - prevTs);
  if (!stackByTid[tid]) stackByTid[tid] = [];
  if (e.ph === 'B') {
    const name = e.name || '(anon)';
    const mod = e.args?.node_module || '(unknown)';
    stackByTid[tid].push({ name, mod, key: `${mod}::${name}` });
  } else {
    stackByTid[tid].pop();
  }
  prevTs = e.ts;
  prevTid = tid;
}

// Layout: icicle, width proportional to value. Skip the synthetic root's own
// bar; render its children as the top row.
const W = 1200;
const ROW = 20;
const PAD = 2;
const MIN_PX = 0.4; // don't draw slivers narrower than this
const total = root.value || 1;

const rects = [];
let maxDepth = 0;
function walk(node, depth, x0, x1) {
  const w = x1 - x0;
  if (w < MIN_PX) return;
  if (depth > MAX_DEPTH) return;
  if (depth > 0) {
    rects.push({ node, depth, x0, w });
    if (depth > maxDepth) maxDepth = depth;
  }
  const kids = [...node.children.values()].sort((a, b) => b.value - a.value);
  let cx = x0;
  for (const k of kids) {
    const kw = (k.value / node.value) * w;
    walk(k, depth + 1, cx, cx + kw);
    cx += kw;
  }
}
walk(root, 0, 0, W);

const H = (maxDepth + 1) * ROW + 40;

function isLib(mod) {
  return LIB.some((m) => mod === m || mod.startsWith(m + '/'));
}
// Color: library frames hot orange/red; react/react-native cool gray-blue;
// everything else muted.
function color(mod) {
  if (isLib(mod)) return '#e8590c';
  if (mod === 'react' || mod === 'react-native' || mod === '@react-native') return '#9db2c8';
  if (mod.startsWith('expo') || mod === '@expo') return '#cbd5e1';
  if (mod === 'Native' || mod === 'JavaScript') return '#d7dee7';
  if (mod === '(unknown)' || mod === 'root') return '#eef2f6';
  return '#b7c3d2';
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">`;
svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
if (title) svg += `<text x="8" y="16" font-size="13" font-weight="700" fill="#0b0e14">${esc(title)}</text>`;
const yOff = title ? 26 : 6;
for (const r of rects) {
  const y = yOff + (r.depth - 1) * ROW;
  const fill = color(r.node.mod);
  const lib = isLib(r.node.mod);
  svg += `<rect x="${r.x0.toFixed(1)}" y="${y}" width="${(r.w - PAD).toFixed(1)}" height="${ROW - PAD}" fill="${fill}" ${lib ? 'stroke="#c92a2a" stroke-width="0.6"' : ''} rx="1"/>`;
  if (r.w > 42) {
    const label = r.w > 120 ? `${r.node.name}` : r.node.name.slice(0, Math.floor(r.w / 6));
    svg += `<text x="${(r.x0 + 3).toFixed(1)}" y="${y + ROW - 6}" fill="${lib ? '#fff' : '#334'}" ${lib ? 'font-weight="700"' : ''}>${esc(label)}</text>`;
  }
}
svg += `</svg>`;
writeFileSync(outPath, svg);
console.log(`wrote ${outPath} (${rects.length} frames, depth ${maxDepth}, total ${(total / 1000).toFixed(0)}ms)`);
