#!/usr/bin/env node
/**
 * Scenario harness for the cloud-sync layer in app.js.
 *
 * Usage:  node tests/sync_harness.js <scenario>
 * Scenarios: offline | adopt-empty-cloud | adopt-cloud-state | conflict-adopts
 *             in-flight-save | bootstrap-fetch-fail | conflict-cap-stops
 *
 * Sets up DOM stubs (same style as smoke.js), installs a fetch() mock backed by
 * an in-memory fake server (its own revision counter, like the real backend),
 * loads app.js (which runs syncBootstrap at the end), then asserts. Prints a
 * JSON result line; exits 0 on pass, 1 on failure. Each scenario runs in its
 * own process (see tests/sync_test.js) so module state is isolated.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Always resolve app files from the repository root regardless of cwd.
process.chdir(path.join(__dirname, '..'));

const SCENARIO = process.argv[2] || 'offline';

// ---------- DOM stubs (mirrors tests/smoke.js) ----------
function classList() {
  const set = new Set();
  return {
    add: v => set.add(v),
    remove: v => set.delete(v),
    toggle: (v, force) => force === undefined ? (set.has(v) ? !set.delete(v) : !!set.add(v)) : (force ? !!set.add(v) : !set.delete(v)),
    contains: v => set.has(v),
  };
}
const nodes = new Map();
function node(id = '') {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id, textContent: '', innerHTML: '', value: '', checked: false, disabled: false,
      title: '', style: {}, dataset: {}, classList: classList(), open: false,
      setAttribute(name, value) { this[name] = value; },
      querySelectorAll() { return []; },
      showModal() { this.open = true; }, close() { this.open = false; }, focus() {}, scrollIntoView() {},
    });
  }
  return nodes.get(id);
}
global.document = {
  querySelector: s => node(s),
  querySelectorAll: () => [],
  addEventListener() {},
};
const localStore = {};
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(localStore, k) ? localStore[k] : null; },
  setItem(k, v) { localStore[k] = String(v); },
  removeItem(k) { delete localStore[k]; },
};
global.requestAnimationFrame = cb => cb();
global.confirm = () => true;
global.speechSynthesis = { cancel() {}, speak() {} };
global.SpeechSynthesisUtterance = function (t) { this.text = t; };
global.window = global;

// ---------- fake server + fetch mock ----------
const calls = { health: 0, get: [], put: [] };
let respondGetState; // () => {status, body}
let respondPutState; // (payload, currentRev) => {status, body}
global.__calls = calls;

function fakeResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const CLOUD_STATE_B = {
  dailyGoal: 25, decks: ['IELTS', 'TOEFL'], excludeBasic: true, pendingPlan: null, queueCollapsed: false, hasSeenGuide: true,
  records: { ambiguous: { stage: 1, last: '2026-08-23', dueDay: '2026-08-24' } },
  streak: 3, lastCheckin: '2026-08-23', checkins: ['2026-08-21', '2026-08-22', '2026-08-23'],
  history: { '2026-08-23': { date: '2026-08-23', items: [{ w: 'ambiguous', type: 'new' }] } },
  skippedSessions: [], session: null, virtualOffset: 0, lastDateAction: null,
};
const CLOUD_STATE_C = { ...CLOUD_STATE_B, dailyGoal: 40, streak: 4, lastCheckin: '2026-08-24' };

// The fake server keeps its own rev, exactly like the Python backend.
function makeFakeServer(initialState) {
  const srv = { state: initialState ? JSON.parse(JSON.stringify(initialState)) : null, rev: 0 };
  if (initialState) srv.rev = 7; // arbitrary non-zero starting revision
  return srv;
}

function installScenario() {
  let server;
  switch (SCENARIO) {
    case 'offline':
      global.fetch = async () => { throw new TypeError('network down'); };
      break;
    case 'adopt-empty-cloud':
      server = makeFakeServer(null);
      respondGetState = () => server.state === null
        ? { status: 404, body: null }
        : { status: 200, body: { state: JSON.parse(JSON.stringify(server.state)), rev: server.rev, savedAt: 'x' } };
      respondPutState = (payload) => {
        const baseRev = payload && Object.prototype.hasOwnProperty.call(payload, 'baseRev') ? payload.baseRev : null;
        if (baseRev !== null && baseRev !== server.rev) return { status: 409, body: { error: 'conflict', rev: server.rev } };
        server.state = JSON.parse(JSON.stringify(payload.state));
        server.rev += 1;
        return { status: 200, body: { ok: true, rev: server.rev, savedAt: new Date().toISOString() } };
      };
      break;
    case 'adopt-cloud-state':
      server = makeFakeServer(CLOUD_STATE_B); // starts at rev 7
      respondGetState = () => ({ status: 200, body: { state: JSON.parse(JSON.stringify(server.state)), rev: server.rev, savedAt: 'x' } });
      respondPutState = (payload) => {
        const baseRev = payload && Object.prototype.hasOwnProperty.call(payload, 'baseRev') ? payload.baseRev : null;
        if (baseRev !== null && baseRev !== server.rev) return { status: 409, body: { error: 'conflict', rev: server.rev } };
        server.state = JSON.parse(JSON.stringify(payload.state));
        server.rev += 1;
        return { status: 200, body: { ok: true, rev: server.rev, savedAt: new Date().toISOString() } };
      };
      break;
    case 'conflict-adopts':
      // Bootstrap serves B @rev7. The first PUT conflicts (a "second device" wrote C);
      // the GET after the conflict serves C @rev9.
      server = makeFakeServer(CLOUD_STATE_B);
      let sawConflict = false;
      respondGetState = () => {
        if (!sawConflict) return { status: 200, body: { state: JSON.parse(JSON.stringify(CLOUD_STATE_B)), rev: 7, savedAt: 'x' } };
        return { status: 200, body: { state: JSON.parse(JSON.stringify(CLOUD_STATE_C)), rev: 9, savedAt: 'y' } };
      };
      respondPutState = (payload) => {
        if (!sawConflict) { sawConflict = true; server.state = CLOUD_STATE_C; server.rev = 9; return { status: 409, body: { error: 'conflict', rev: 9 } }; }
        const baseRev = payload && Object.prototype.hasOwnProperty.call(payload, 'baseRev') ? payload.baseRev : null;
        if (baseRev !== null && baseRev !== server.rev) return { status: 409, body: { error: 'conflict', rev: server.rev } };
        server.state = JSON.parse(JSON.stringify(payload.state));
        server.rev += 1;
        return { status: 200, body: { ok: true, rev: server.rev, savedAt: new Date().toISOString() } };
      };
      break;
    case 'conflict-cap-stops': {
      // A rival device keeps winning between our push and adopt (two active devices).
      // Auto-adopt must stop at the cap, keep the last adopted document locally, flag
      // a conflict state instead of silently looping, and notify exactly once.
      server = makeFakeServer(CLOUD_STATE_B);
      let isFirstGet = true;
      let adoptCount = 0;
      respondGetState = () => {
        if (isFirstGet) { isFirstGet = false; return { status: 200, body: { state: JSON.parse(JSON.stringify(CLOUD_STATE_B)), rev: 7, savedAt: 'x' } }; } // bootstrap
        adoptCount += 1;
        const doc = { ...CLOUD_STATE_C, dailyGoal: 40 + adoptCount };
        return { status: 200, body: { state: JSON.parse(JSON.stringify(doc)), rev: 7 + adoptCount * 2, savedAt: 'x' } };
      };
      respondPutState = () => ({ status: 409, body: { error: 'conflict', rev: server.rev + 1 } }); // rival always wins
      break;
    }
    case 'in-flight-save': {
      // Bootstrap adopts B@7; its resync PUT is held open by a gate so the test can
      // save() while a push is in flight (the busy-drop path). The save must be
      // coalesced into a follow-up push, not silently dropped.
      server = makeFakeServer(CLOUD_STATE_B);
      let releasePush;
      const gate = new Promise(resolve => { releasePush = resolve; });
      global.__releaseInFlightPush = () => releasePush();
      global.__inFlightServer = server;
      respondGetState = () => ({ status: 200, body: { state: JSON.parse(JSON.stringify(server.state)), rev: server.rev, savedAt: 'x' } });
      let putCount = 0;
      respondPutState = async (payload) => {
        putCount += 1;
        if (putCount === 1) await gate; // hold the first push in flight
        const baseRev = payload && Object.prototype.hasOwnProperty.call(payload, 'baseRev') ? payload.baseRev : null;
        if (baseRev !== null && baseRev !== server.rev) return { status: 409, body: { error: 'conflict', rev: server.rev } };
        server.state = JSON.parse(JSON.stringify(payload.state));
        server.rev += 1;
        return { status: 200, body: { ok: true, rev: server.rev, savedAt: new Date().toISOString() } };
      };
      break;
    }
    case 'bootstrap-fetch-fail': {
      // Health is OK but the bootstrap GET /api/state keeps failing until the test
      // flips the flag (a transient outage plus the delayed retry recovering it).
      server = makeFakeServer(CLOUD_STATE_B);
      let failing = true;
      global.__bootstrapFailMode = v => { failing = !!v; };
      respondGetState = () => {
        if (failing) throw new TypeError('network down');
        return { status: 200, body: { state: JSON.parse(JSON.stringify(server.state)), rev: server.rev, savedAt: 'x' } };
      };
      respondPutState = (payload) => {
        const baseRev = payload && Object.prototype.hasOwnProperty.call(payload, 'baseRev') ? payload.baseRev : null;
        if (baseRev !== null && baseRev !== server.rev) return { status: 409, body: { error: 'conflict', rev: server.rev } };
        server.state = JSON.parse(JSON.stringify(payload.state));
        server.rev += 1;
        return { status: 200, body: { ok: true, rev: server.rev, savedAt: new Date().toISOString() } };
      };
      break;
    }
    default:
      throw new Error('unknown scenario ' + SCENARIO);
  }

  // The dispatcher below is the "server reachable" fetch. Offline scenarios must
  // keep their throwing fetch, so only install it when a responder exists.
  if (respondGetState || respondPutState) {
    global.fetch = async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (String(url).endsWith('/api/health')) {
        calls.health += 1;
        return fakeResponse(200, { ok: true });
      }
      if (String(url).endsWith('/api/state') && method === 'GET') {
        const r = await respondGetState(calls.get.length);
        calls.get.push({ url });
        return fakeResponse(r.status, r.body);
      }
      if (String(url).endsWith('/api/state') && method === 'PUT') {
        let payload = null;
        try { payload = JSON.parse(opts.body); } catch { /* keep null */ }
        calls.put.push(payload);
        const r = await respondPutState(payload, server ? server.rev : 0);
        return fakeResponse(r.status, r.body);
      }
      throw new TypeError('fetch mock: unhandled ' + method + ' ' + url);
    };
  }
}
installScenario();

// ---------- load app.js with test exports appended ----------
const app = fs.readFileSync('app.js', 'utf8') + `
;globalThis.__syncTest = {
  get sync() { return sync; },
  get state() { return state; },
  save,
  syncBootstrap,
};`;
vm.runInThisContext(fs.readFileSync('data/exam-vocab.js', 'utf8'), { filename: 'exam-vocab.js' });
vm.runInThisContext(fs.readFileSync('vocab.js', 'utf8'), { filename: 'vocab.js' });
vm.runInThisContext(fs.readFileSync('app-meta.js', 'utf8'), { filename: 'app-meta.js' });
vm.runInThisContext(app, { filename: 'app.js' });

// Capture every toast the app emits (top-level function declaration -> global property).
const toastLog = [];
{
  const realToast = globalThis.toast;
  globalThis.toast = message => { toastLog.push(String(message)); if (typeof realToast === 'function') realToast.call(globalThis, message); };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function settle(ms = 30) { await sleep(ms); }

// ---------- scenario assertions ----------
async function run() {
  const KEY = 'shici-memory-v1';
  const t = global.__syncTest;

  if (SCENARIO === 'offline') {
    await settle(50);
    assert.strictEqual(t.sync.enabled, false, 'sync must stay disabled when /api/health is unreachable');
    t.state.dailyGoal = 42;
    t.save();
    assert.strictEqual(JSON.parse(localStore[KEY]).dailyGoal, 42, 'local persistence must keep working offline');
    await settle(50);
    assert.strictEqual(calls.health + calls.get.length + calls.put.length, 0, 'no API traffic when sync is disabled');
  }

  if (SCENARIO === 'adopt-empty-cloud') {
    await settle(60);
    assert.strictEqual(t.sync.enabled, true, 'health probe must enable sync');
    assert.strictEqual(t.sync.ready, true, 'seeding an empty cloud must mark sync ready');
    assert.strictEqual(calls.put.length, 1, 'bootstrap of an empty store should seed exactly once');
    const seed = calls.put[0];
    assert.strictEqual(seed.baseRev, 0, 'seeding an empty store should base on rev 0');
    // A subsequent save must carry the server-assigned revision.
    t.state.dailyGoal = 25;
    t.save();
    await settle(60);
    const push = calls.put[1];
    assert.ok(push, 'save() after bootstrap must push to cloud');
    assert.strictEqual(push.baseRev, 1, 'push must reference the rev returned by the seed');
    assert.strictEqual(push.state.dailyGoal, 25, 'pushed payload must contain the current state');
  }

  if (SCENARIO === 'adopt-cloud-state') {
    await settle(60);
    assert.strictEqual(t.sync.ready, true);
    // Adopting cloud state triggers exactly one resync save (refreshAll), so the
    // revision must advance from the adopted 7 to 8.
    assert.strictEqual(t.sync.rev, 8, 'bootstrap adopts rev 7 and the follow-up save advances it to 8');
    assert.deepStrictEqual(t.state.records, CLOUD_STATE_B.records, 'in-memory state must adopt the cloud document');
    const stored = JSON.parse(localStore[KEY]);
    assert.deepStrictEqual(stored.records, CLOUD_STATE_B.records, 'cloud state must replace the local cache so it survives reloads');
    assert.strictEqual(t.state.streak, 3);
    // First post-adopt push (fired by refreshAll) must base on the adopted rev.
    const firstPostAdopt = calls.put[0];
    assert.ok(firstPostAdopt, 'adopting cloud state should trigger a resync save');
    assert.strictEqual(firstPostAdopt.baseRev, 7, 'post-adopt push must use the adopted revision');
  }

  if (SCENARIO === 'conflict-adopts') {
    await settle(100);
    // Bootstrap adopts B@7; refreshAll's save hits a 409 (concurrent writer) and
    // syncAdopt() must fetch C@9, replace state + local cache, then re-save.
    assert.ok(calls.put.length >= 1 && calls.get.length >= 2, 'conflict flow should end with an adopt GET');
    assert.strictEqual(t.state.dailyGoal, 40, 'state must be replaced by the newer cloud document (last-writer-wins)');
    assert.deepStrictEqual(t.state.records, CLOUD_STATE_C.records);
    const stored = JSON.parse(localStore[KEY]);
    assert.strictEqual(stored.dailyGoal, 40, 'adopted state must also persist to localStorage');
    assert.ok(Number.isInteger(t.sync.rev) && t.sync.rev >= 9, 'revision must advance past the adopted rev after the resync save');
  }

  if (SCENARIO === 'conflict-cap-stops') {
    await settle(150);
    assert.strictEqual(t.sync.busy, false, 'the push chain must terminate');
    assert.strictEqual(t.sync.conflict, true, 'repeated conflicts must flag a conflict state');
    assert.strictEqual(t.sync.ready, false, 'sync must stop pushing after the adopt cap is hit');
    assert.ok(calls.put.length >= 4 && calls.get.length >= 4, 'chain must run push/adopt rounds before stopping');
    const conflictNotices = toastLog.filter(m => m.includes('连续冲突')).length;
    assert.strictEqual(conflictNotices, 1, 'exactly one conflict-stopped notice (no silent loop)');
    assert.ok(t.state.dailyGoal >= 41, 'local state must hold the last adopted cloud document');
    const stored = JSON.parse(localStore[KEY]);
    assert.strictEqual(stored.dailyGoal, t.state.dailyGoal, 'the stop must not lose the last adopted document locally');
  }

  if (SCENARIO === 'in-flight-save') {
    await settle(80);
    assert.strictEqual(t.sync.ready, true, 'bootstrap must complete before the first push starts');
    assert.strictEqual(calls.put.length, 1, 'the bootstrap resync push is in flight and held open by the gate');
    assert.strictEqual(t.sync.busy, true, 'busy flag must be set while a push is in flight');

    // A save landing mid-flight must be coalesced, not dropped.
    t.state.dailyGoal = 77;
    t.save();
    await settle(50);
    assert.strictEqual(calls.put.length, 1, 'no second PUT may start before the first one resolves');

    global.__releaseInFlightPush();
    await settle(80);
    assert.strictEqual(t.sync.busy, false, 'the push chain must finish after the gate releases');
    assert.ok(calls.put.length >= 2, 'the mid-flight save must be coalesced into a follow-up push');
    const followUp = calls.put[1];
    assert.strictEqual(followUp.baseRev, 8, 'follow-up push must build on the rev returned by the first push');
    assert.strictEqual(followUp.state.dailyGoal, 77, 'coalesced push must carry the save that arrived mid-flight');
    assert.strictEqual(t.sync.rev, 9, 'revision must end at adopted(7) + two pushes');
    const stored = JSON.parse(localStore[KEY]);
    assert.strictEqual(stored.dailyGoal, 77, 'local cache keeps the edit regardless of cloud outcome');
    assert.strictEqual(global.__inFlightServer.state.dailyGoal, 77, 'cloud document must end with the coalesced save');
  }

  if (SCENARIO === 'bootstrap-fetch-fail') {
    await settle(80);
    assert.strictEqual(t.sync.enabled, true, 'a healthy /api/health must enable sync even when the state fetch fails');
    assert.strictEqual(t.sync.ready, false, 'a failed bootstrap must not mark sync ready');

    // Simulate several retry attempts while still failing: exactly one user notice.
    await t.syncBootstrap();
    await t.syncBootstrap();
    await settle(50);
    const unavailable = toastLog.filter(m => m.includes('无法连接云端同步服务')).length;
    assert.strictEqual(unavailable, 1, 'exactly one "sync unavailable" notice across repeated failed bootstraps');

    // Saves must keep working locally without touching the cloud.
    t.state.dailyGoal = 66;
    t.save();
    await settle(50);
    assert.strictEqual(calls.put.length, 0, 'saves must not hit the cloud while bootstrap is incomplete');
    assert.strictEqual(JSON.parse(localStore[KEY]).dailyGoal, 66, 'local persistence keeps working during an outage');

    // Recovery: the delayed retry (invoked directly here) must re-adopt cloud state.
    global.__bootstrapFailMode(false);
    await t.syncBootstrap();
    await settle(80);
    assert.strictEqual(t.sync.ready, true, 'a successful retry must bring sync back to ready');
    assert.deepStrictEqual(t.state.records, CLOUD_STATE_B.records, 'recovered bootstrap adopts the cloud document');
    const stored = JSON.parse(localStore[KEY]);
    assert.deepStrictEqual(stored.records, CLOUD_STATE_B.records, 'adopted state must persist to localStorage');
    assert.ok(Number.isInteger(t.sync.rev) && t.sync.rev >= 8, 'adopt rev 7 plus the resync save must advance the revision');
  }

  return { scenario: SCENARIO, ok: true };
}

run().then(result => {
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch(err => {
  console.error('SCENARIO FAILED [' + SCENARIO + ']:', err && (err.message || String(err)));
  if (process.env.SHICI_DEBUG) console.error(err.stack);
  process.exit(1);
});
