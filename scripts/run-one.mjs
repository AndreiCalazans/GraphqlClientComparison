#!/usr/bin/env node
/**
 * Run one (variant, test) case end-to-end and capture all three artifacts:
 *
 *   1. Flashlight  → FPS + RAM + CPU JSON (median of N iterations of the flow)
 *   2. Hermes      → cpuprofile (auto-dumped ~20s after JS entry by the app;
 *                    the flow finishes inside that window) pulled + source-mapped
 *   3. Maestro     → screen-recorded video of one flow run
 *
 * Usage:
 *   node scripts/run-one.mjs <variant> <t1|t2|t3> [--iterations N]
 *
 * Artifacts land in results/<variant>__<test>/.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = resolve(ROOT, 'harness');
const APP = 'com.perf.gqlharness';
const FLASHLIGHT = process.env.FLASHLIGHT_BIN || `${process.env.HOME}/.flashlight/bin/flashlight`;
const MAESTRO = process.env.MAESTRO_BIN || 'maestro';
const CONVERT = resolve(
  process.env.HOME,
  'dev/StateOfReactNativeNavigation/perf-tooling/scripts/convert-hermes-profile.js',
);
const SOURCEMAP = resolve(
  HARNESS,
  'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map',
);

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('close', (code) => res(code ?? 0));
  });
}

async function main() {
  const variant = process.argv[2];
  const test = process.argv[3];
  const iterFlag = process.argv.indexOf('--iterations');
  const iterations = iterFlag > 0 ? Number(process.argv[iterFlag + 1]) : 3;
  if (!variant || !test) {
    console.error('usage: run-one.mjs <variant> <t1|t2|t3> [--iterations N]');
    process.exit(1);
  }
  const key = `${variant}__${test}`;
  const flow = resolve(ROOT, 'maestro', `${key}.yaml`);
  if (!existsSync(flow)) {
    console.error(`no flow: ${flow}`);
    process.exit(1);
  }
  const outDir = resolve(ROOT, 'results', key);
  mkdirSync(outDir, { recursive: true });

  // ---- 1. Flashlight (FPS + RAM + CPU) ----
  console.log(`\n▶ [${key}] Flashlight (${iterations} iters)`);
  const flJson = resolve(outDir, 'flashlight.json');
  const flCode = await run(FLASHLIGHT, [
    'test',
    '--bundleId', APP,
    '--testCommand', `${MAESTRO} test ${flow}`,
    '--duration', '0',
    '--iterationCount', String(iterations),
    '--resultsTitle', key,
    '--resultsFilePath', flJson,
  ]);
  console.log(`  flashlight exit=${flCode}`);

  // ---- 2 + 3. One clean run: record video + pull the Hermes cpuprofile ----
  console.log(`▶ [${key}] Hermes profile + video run`);
  sh(`adb shell pm clear ${APP}`, { stdio: 'ignore' });
  try { sh(`adb shell 'rm -f /sdcard/Download/sampling-profiler-trace*'`, { stdio: 'ignore' }); } catch {}
  const devVid = `/sdcard/rec_${key}.mp4`;
  try { sh(`adb shell rm -f ${devVid}`, { stdio: 'ignore' }); } catch {}

  // Start screen recording in the background.
  const rec = spawn(
    'adb',
    ['shell', 'screenrecord', '--bit-rate', '6000000', '--time-limit', '180', devVid],
    { stdio: 'ignore' },
  );

  await sleep(500);
  // Drive the flow once (this also launches via the variant deep link).
  const t0 = Date.now();
  await run(MAESTRO, ['test', flow]);
  console.log(`  flow ran in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Stop recording (send SIGINT so screenrecord flushes the file).
  try { sh(`adb shell 'pkill -INT screenrecord'`, { stdio: 'ignore' }); } catch {}
  rec.kill('SIGINT');
  await sleep(1500);
  try {
    sh(`adb pull ${devVid} ${resolve(outDir, 'video.mp4')}`, { stdio: 'ignore' });
    console.log('  video -> video.mp4');
  } catch { console.log('  (no video pulled)'); }

  // The flow taps the stop-profiler button and waits for the `profiler-done`
  // marker, which flips only AFTER stopProfiling(true) resolves — so the
  // cpuprofile is already on disk. Poll briefly in case the toast/file lands a
  // fraction late.
  console.log('  locating Hermes dump…');
  let prof = '';
  for (let i = 0; i < 15; i++) {
    prof = sh(`adb shell ls /sdcard/Download/ 2>/dev/null || true`)
      .split('\n')
      .map((s) => s.trim())
      .find((s) => /sampling-profiler-trace.*\.cpuprofile/.test(s)) || '';
    if (prof) break;
    await sleep(1000);
  }
  if (prof) {
    const raw = resolve(outDir, 'hermes-raw.cpuprofile.txt');
    sh(`adb shell "cat /sdcard/Download/${prof}" > "${raw}"`);
    console.log(`  hermes raw -> ${raw}`);
    // Source-map it to human-readable frames.
    const smArgs = existsSync(SOURCEMAP) ? ['--sourcemap', SOURCEMAP] : [];
    const code = await run('node', [
      CONVERT,
      '--in', raw,
      '--out', resolve(outDir, 'hermes.json'),
      '--app-dir', HARNESS,
      ...smArgs,
    ]);
    if (code === 0) console.log('  hermes -> hermes.json');
    else console.log('  (hermes conversion failed)');
  } else {
    console.log('  (no Hermes cpuprofile produced)');
  }

  console.log(`✔ [${key}] done → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
