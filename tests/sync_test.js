#!/usr/bin/env node
/**
 * Cloud-sync layer scenario tests. Each scenario runs in a fresh child
 * process (module state isolation) and must exit 0 with a JSON line.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SCENARIOS = ['offline', 'adopt-empty-cloud', 'adopt-cloud-state', 'conflict-adopts', 'in-flight-save', 'bootstrap-fetch-fail', 'conflict-cap-stops'];
let failed = 0;

for (const scenario of SCENARIOS) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'sync_harness.js'), scenario], {
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 30000,
  });
  if (result.status === 0) {
    console.log(`PASS ${scenario}`);
  } else {
    failed += 1;
    console.error(`FAIL ${scenario}\n${result.stdout || ''}${result.stderr || ''}`);
  }
}

if (failed > 0) {
  console.error(`${failed}/${SCENARIOS.length} sync scenario(s) failed`);
  process.exit(1);
}
console.log('all sync scenarios passed');
