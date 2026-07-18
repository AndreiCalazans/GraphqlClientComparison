#!/usr/bin/env node
/**
 * Run the full matrix: 6 variants × 3 tests, each producing Flashlight JSON,
 * a source-mapped Hermes cpuprofile and a video. Then aggregate.
 *
 *   node scripts/run-all.mjs [--iterations N] [--variants a,b] [--tests t1,t2]
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ALL_VARIANTS = ['vanilla', 'tanstack', 'rtk', 'zustand', 'jotai', 'relay'];
const ALL_TESTS = ['t1', 't2', 't3'];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

const iterations = arg('--iterations', '3');
const variants = (arg('--variants', '') || '').split(',').filter(Boolean);
const tests = (arg('--tests', '') || '').split(',').filter(Boolean);
const V = variants.length ? variants : ALL_VARIANTS;
const T = tests.length ? tests : ALL_TESTS;

function run(cmd, args) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', (code) => res(code ?? 0));
  });
}

async function main() {
  const started = Date.now();
  for (const variant of V) {
    for (const test of T) {
      console.log(`\n========== ${variant} / ${test} ==========`);
      const code = await run('node', [
        resolve(ROOT, 'scripts', 'run-one.mjs'),
        variant,
        test,
        '--iterations',
        iterations,
      ]);
      if (code !== 0) console.error(`  ✖ ${variant}/${test} exited ${code}`);
    }
  }
  console.log(`\nmatrix done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  await run('node', [resolve(ROOT, 'scripts', 'aggregate.mjs')]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
