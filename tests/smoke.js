const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function classList() {
  const set = new Set();
  return {
    add: value => set.add(value),
    remove: value => set.delete(value),
    toggle: (value, force) => force === undefined
      ? (set.has(value) ? !set.delete(value) : !!set.add(value))
      : (force ? !!set.add(value) : !set.delete(value)),
    contains: value => set.has(value),
  };
}

const nodes = new Map();
function node(id = '') {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      disabled: false,
      title: '',
      style: {},
      dataset: {},
      classList: classList(),
      setAttribute(name, value) { this[name] = value; },
      querySelectorAll() { return []; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() {},
      scrollIntoView() {},
    });
  }
  return nodes.get(id);
}

global.document = {
  querySelector: selector => node(selector),
  querySelectorAll: () => [],
  addEventListener() {},
};
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, value) { this.data[key] = value; },
  removeItem(key) { delete this.data[key]; },
};
global.requestAnimationFrame = callback => callback();
global.confirm = () => true;
global.speechSynthesis = { cancel() {}, speak() {} };
global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
global.window = global;

vm.runInThisContext(fs.readFileSync('data/exam-vocab.js', 'utf8'), { filename: 'data/exam-vocab.js' });
vm.runInThisContext(fs.readFileSync('vocab.js', 'utf8'), { filename: 'vocab.js' });
vm.runInThisContext(fs.readFileSync('app-meta.js', 'utf8'), { filename: 'app-meta.js' });
const app = fs.readFileSync('app.js', 'utf8') + `
;globalThis.__appTest = {
  get state() { return state; },
  q: () => queue,
  currentItem: () => queue[current],
  setState(data) { state = data; queue = []; current = 0; },
  reload() { state = load(); queue = []; current = 0; hydrateQueue(); return state; },
  save,
  rate,
  checkIn,
  jumpDays,
  renderWord,
  renderLibrary,
  setLibraryFilter(value) { filter = value; libraryPage = 1; },
  goToLibraryPage,
  isBasicWord,
  selectedWords,
  recoverLegacyHistory,
  syncTodaySessionToPlan,
  openWordPreview,
  relationWords,
  affixNotes,
  renderQueueLayout,
  renderQueue,
  setStudyDate,
  effectiveDate,
  realToday,
  addDays,
  dateKey,
  renderGuide,
  hydrateQueue,
  renderHistory,
  historyMarkup,
  difficultySummary,
  makeSessionItem,
  normalizeSessionItems,
  sessionReadyForCheckIn,
  itemHadDifficulty,
  feedbackLabel,
  historyFeedbackText,
  snapshotHadDifficulty,
  appendDueReviews,
  parseVersion,
  compareVersions,
  renderProjectMeta,
  checkForUpdates,
  fetchLatestRelease,
  releaseZipAsset,
  isPagesDeployment,
  progressExportPayload,
  parseProgressImport,
  applyImportedProgress,
};`;
vm.runInThisContext(app, { filename: 'app.js' });

const STORAGE_KEY = 'shici-memory-v1';
const TEST_WORDS = VOCAB.slice(0, 10).map(word => word.w);

function cleanState(overrides = {}) {
  return {
    dailyGoal: 3,
    decks: ['IELTS', 'TOEFL', 'GRE', 'PTE'],
    excludeBasic: false,
    revealMode: false,
    pendingPlan: null,
    queueCollapsed: false,
    hasSeenGuide: true,
    records: {},
    streak: 0,
    lastCheckin: null,
    checkins: [],
    history: {},
    skippedSessions: [],
    session: null,
    virtualOffset: 0,
    lastDateAction: null,
    ...overrides,
  };
}

function resetState(overrides = {}) {
  localStorage.data = {};
  __appTest.setState(cleanState(overrides));
  __appTest.save();
  return __appTest.state;
}

function seedSession(items, options = {}) {
  const state = __appTest.state;
  state.session = {
    date: options.date || __appTest.dateKey(),
    checkedIn: !!options.checkedIn,
    schemaVersion: 2,
    plan: options.plan || {
      dailyGoal: state.dailyGoal,
      decks: [...state.decks],
      excludeBasic: state.excludeBasic,
    },
    items: items.map(item => {
      if (typeof item === 'string') return __appTest.makeSessionItem(item, 'new');
      if (item.initialDone !== undefined || item.attempts !== undefined) {
        return {
          ...item,
          attempts: Array.isArray(item.attempts) ? item.attempts.map(attempt => ({ ...attempt })) : item.attempts,
        };
      }
      return __appTest.makeSessionItem(item.w, item.type || 'new');
    }),
  };
  if (options.checkinDate) state.session.checkinDate = options.checkinDate;
  __appTest.save();
  __appTest.hydrateQueue();
  return state.session;
}

function historyItem(word) {
  const entry = __appTest.state.history[__appTest.state.lastCheckin];
  return entry && entry.items.find(item => item.w === word);
}

// Initial feedback must advance through the whole sheet, while difficult words stay unresolved.
{
  const [first, second, third] = TEST_WORDS;
  resetState();
  seedSession([first, second, third]);

  __appTest.rate('hard');
  let stored = __appTest.state.session.items[0];
  assert.strictEqual(stored.initialDone, true, 'hard should complete only the initial encounter');
  assert.strictEqual(stored.done, false, 'hard must remain unresolved for reinforcement');
  assert.strictEqual(stored.rating, 'hard', 'the latest hard feedback should be retained');
  assert.deepStrictEqual(
    stored.attempts.map(({ rating, phase, attemptNo }) => ({ rating, phase, attemptNo })),
    [{ rating: 'hard', phase: 'initial', attemptNo: 1 }],
    'the initial hard attempt should be recorded explicitly',
  );
  assert.strictEqual(__appTest.currentItem().w, second, 'hard should advance to the next initial word');

  __appTest.rate('again');
  stored = __appTest.state.session.items[1];
  assert.strictEqual(stored.initialDone, true, 'again should complete only the initial encounter');
  assert.strictEqual(stored.done, false, 'again must remain unresolved for reinforcement');
  assert.strictEqual(__appTest.currentItem().w, third, 'again should persist and advance instead of trapping the first pass');

  __appTest.rate('good');
  assert.deepStrictEqual(
    __appTest.q().map(item => item.w),
    [first, second],
    'after the initial pass, only unresolved difficult words should enter reinforcement',
  );
  assert.ok(__appTest.q().every(item => item.reinforcement), 'the second queue should be marked as reinforcement');
  assert.match(node('#queueList').innerHTML, /强化回顾/, 'the queue should identify the reinforcement pass');

  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'check-in must be rejected while reinforcement words remain');
  assert.strictEqual(Object.keys(__appTest.state.records).length, 0, 'an uncleared sheet must not commit progress');

  // Multiple difficult words must cycle independently until each receives a final good response.
  __appTest.rate('hard');
  assert.strictEqual(__appTest.currentItem().w, second, 'an unresolved reinforcement word should rotate to the next word');
  __appTest.rate('good');
  assert.deepStrictEqual(__appTest.q().map(item => item.w), [first], 'a cleared word should leave the reinforcement queue');
  __appTest.rate('again');
  assert.deepStrictEqual(__appTest.q().map(item => item.w), [first], 'again during reinforcement should keep the word in the loop');
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'reinforcement attempts themselves must not check in');
  __appTest.rate('good');
  assert.strictEqual(__appTest.sessionReadyForCheckIn(), true, 'all canonical items should be ready only after every difficult word is cleared');

  const attemptsBeforeCheckIn = __appTest.state.session.items[0].attempts;
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'a fully cleared sheet should check in');
  assert.strictEqual(Object.keys(__appTest.state.records).length, 3, 'check-in should commit every canonical task item once');

  const firstSnapshot = historyItem(first);
  const secondSnapshot = historyItem(second);
  const easySnapshot = historyItem(third);
  assert.deepStrictEqual(
    firstSnapshot.attempts.map(({ rating, phase, attemptNo }) => ({ rating, phase, attemptNo })),
    [
      { rating: 'hard', phase: 'initial', attemptNo: 1 },
      { rating: 'hard', phase: 'reinforcement', attemptNo: 2 },
      { rating: 'again', phase: 'reinforcement', attemptNo: 3 },
      { rating: 'good', phase: 'reinforcement', attemptNo: 4 },
    ],
    'history should preserve every initial and reinforcement attempt in order',
  );
  assert.notStrictEqual(firstSnapshot.attempts, attemptsBeforeCheckIn, 'history attempts should be a snapshot rather than the live session array');
  assert.strictEqual(firstSnapshot.initialRating, 'hard', 'history should retain the first-pass rating');
  assert.strictEqual(firstSnapshot.finalRating, 'good', 'history should retain the final clearing rating');
  assert.strictEqual(firstSnapshot.hadDifficulty, true, 'history should flag words that were ever difficult');
  assert.strictEqual(firstSnapshot.reinforcementAttempts.length, 3, 'history should expose reinforcement attempt count');
  assert.strictEqual(secondSnapshot.initialRating, 'again', 'initial again should remain visible after final good');
  assert.strictEqual(secondSnapshot.hadDifficulty, true, 'again should count as a difficult encounter');
  assert.strictEqual(easySnapshot.hadDifficulty, false, 'an initially remembered word should not be marked difficult');
  assert.deepStrictEqual(easySnapshot.reinforcementAttempts, [], 'an easy word should not acquire reinforcement attempts');

  const difficult = __appTest.difficultySummary();
  assert.ok(difficult.has(first) && difficult.has(second), 'difficulty analytics should include both hard and again histories');
  __appTest.renderHistory(__appTest.state.lastCheckin);
  assert.match(node('#historyCalendarGrid').innerHTML, /data-history-calendar-date/, 'history should expose a clickable calendar day');
  assert.match(node('#historyDetail').innerHTML, /强化/, 'history detail should explain reinforcement work');
}

// Reloading in the middle of reinforcement must reconstruct the queue from canonical session items.
{
  const [first, second] = TEST_WORDS.slice(3, 5);
  resetState({ dailyGoal: 2 });
  seedSession([first, second]);
  __appTest.rate('hard');
  __appTest.rate('good');
  assert.deepStrictEqual(__appTest.q().map(item => item.w), [first], 'the pre-reload reinforcement queue should contain the hard word');
  assert.ok(localStorage.data[STORAGE_KEY], 'the in-progress reinforcement state should be persisted');

  __appTest.reload();
  assert.deepStrictEqual(__appTest.q().map(item => item.w), [first], 'reload should resume the same reinforcement word without adding duplicates');
  assert.strictEqual(__appTest.currentItem().reinforcement, true, 'reload should restore reinforcement mode');
  assert.deepStrictEqual(
    __appTest.state.session.items.find(item => item.w === first).attempts.map(attempt => attempt.rating),
    ['hard'],
    'reload should preserve prior attempts',
  );
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'reload must not make an unresolved sheet eligible for check-in');
  __appTest.rate('good');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'the restored sheet should check in after clearing reinforcement');
}

// A difficult later-stage review returns tomorrow, and multiple reinforcement attempts advance its stage only once.
{
  const word = TEST_WORDS[5];
  resetState({ dailyGoal: 1 });
  const today = __appTest.dateKey();
  __appTest.state.records[word] = {
    stage: 1,
    last: __appTest.dateKey(__appTest.addDays(__appTest.effectiveDate(), -1)),
    dueDay: today,
  };
  seedSession([{ w: word, type: 'review' }]);
  __appTest.rate('hard');
  __appTest.rate('again');
  __appTest.rate('good');
  __appTest.checkIn();

  assert.strictEqual(__appTest.state.records[word].stage, 2, 'a review stage should advance exactly once per checked-in day');
  assert.strictEqual(
    __appTest.state.records[word].dueDay,
    __appTest.dateKey(__appTest.addDays(__appTest.effectiveDate(), 1)),
    'a word that was ever difficult should be scheduled for the next day even when finally cleared with good',
  );
  assert.strictEqual(historyItem(word).learningRound, 3, 'reinforcement attempts must not inflate the learning-round number');
  assert.strictEqual(historyItem(word).attempts.length, 3, 'all attempts should remain attached to the single learning round');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.records[word].stage, 2, 'repeated check-in calls must not advance the same round twice');
  assert.strictEqual(Object.keys(__appTest.state.history).length, 1, 'repeated check-in calls must not duplicate history');

  const tomorrow = __appTest.addDays(__appTest.effectiveDate(), 1);
  assert.strictEqual(__appTest.setStudyDate(tomorrow, 'carry'), true, 'a checked-in sheet should be able to open the next study day');
  const dueReview = __appTest.state.session.items.find(item => item.w === word);
  assert.ok(dueReview && dueReview.type === 'review', 'the difficult word should automatically appear in tomorrow\'s review sheet');
  assert.strictEqual(dueReview.initialDone, false, 'a scheduled review should begin a new initial pass');
  assert.deepStrictEqual(dueReview.attempts, [], 'a new day should not reuse yesterday\'s reinforcement attempts');
}

// A word marked as fully known (熟词) is skipped past every review stage and never reappears.
{
  const [knownWord, easyWord] = TEST_WORDS.slice(8, 10);
  resetState({ dailyGoal: 2 });
  seedSession([knownWord, easyWord]);

  __appTest.rate('known');
  let stored = __appTest.state.session.items.find(item => item.w === knownWord);
  assert.strictEqual(stored.initialDone, true, 'known should complete the initial encounter');
  assert.strictEqual(stored.done, true, 'known resolves the word immediately without reinforcement');
  assert.strictEqual(stored.rating, 'known', 'the latest known feedback should be retained');
  assert.deepStrictEqual(
    stored.attempts.map(({ rating, phase, attemptNo }) => ({ rating, phase, attemptNo })),
    [{ rating: 'known', phase: 'initial', attemptNo: 1 }],
    'the initial known attempt should be recorded explicitly',
  );

  __appTest.rate('good');
  assert.strictEqual(__appTest.sessionReadyForCheckIn(), true, 'a sheet mixing known and good should be ready for check-in');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'the mixed sheet should check in normally');

  const knownRecord = __appTest.state.records[knownWord];
  assert.strictEqual(knownRecord.stage, 4, 'a newly marked known word should skip straight to the final stage');
  assert.strictEqual(knownRecord.dueDay, null, 'a known word must never be scheduled for review again');
  const easyRecord = __appTest.state.records[easyWord];
  assert.strictEqual(easyRecord.stage, 0, 'an ordinary good rating should keep the normal first review stage');

  const knownSnapshot = historyItem(knownWord);
  assert.strictEqual(knownSnapshot.initialRating, 'known', 'history should retain the initial known rating');
  assert.strictEqual(knownSnapshot.finalRating, 'known', 'history should retain the final known rating');
  assert.strictEqual(knownSnapshot.hadDifficulty, false, 'a known word is not a difficult encounter');
  assert.deepStrictEqual(knownSnapshot.reinforcementAttempts, [], 'a known word should never acquire reinforcement attempts');

  const nextDay = __appTest.addDays(__appTest.effectiveDate(), 1);
  assert.strictEqual(__appTest.setStudyDate(nextDay, 'carry'), true, 'the checked-in sheet should open the next study day');
  const reappeared = __appTest.state.session.items.find(item => item.w === knownWord);
  assert.ok(!reappeared, 'a known word must not appear in a later review sheet');

  __appTest.renderLibrary();
  assert.match(node('#libraryList').innerHTML, /已掌握 · 免复习/, 'the library should surface the known state instead of a stage number');
}

// Rating labels and legacy hard feedback keep working after the 费力 button was merged into 模糊.
{
  assert.strictEqual(__appTest.feedbackLabel('known'), '熟词', 'known should render as 熟词 in history text');
  assert.strictEqual(__appTest.feedbackLabel('hard'), '费力', 'legacy hard feedback must still be readable');

  const knownItem = { attempts: [{ rating: 'known', phase: 'initial', attemptNo: 1 }], initialRating: 'known' };
  assert.strictEqual(__appTest.snapshotHadDifficulty(knownItem), false, 'a known-only history item is not difficult');
  assert.strictEqual(__appTest.historyFeedbackText(knownItem), '初轮熟词 · 免复习', 'history should explain the known exit path');

  const hardLegacy = { attempts: [{ rating: 'hard', phase: 'initial', attemptNo: 1 }] };
  assert.match(__appTest.historyFeedbackText(hardLegacy), /费力/, 'legacy difficult history text must still be readable');

  const normalized = { items: [
    { w: 'alpha', type: 'new', attempts: [{ rating: 'known', phase: 'initial' }] },
    { w: 'beta', type: 'new', rating: 'hard', initialDone: true, done: false },
    { w: 'gamma', type: 'new', attempts: [{ rating: 'nope', phase: 'initial' }, { rating: 'again', phase: 'reinforcement' }] },
  ] };
  __appTest.normalizeSessionItems(normalized);
  assert.deepStrictEqual(
    normalized.items[0].attempts.map(attempt => attempt.rating),
    ['known'],
    'known attempts must survive normalization instead of being dropped as invalid',
  );
  assert.strictEqual(normalized.items[0].done, true, 'a known item should stay resolved after normalization');
  assert.deepStrictEqual(
    normalized.items[1].attempts.map(attempt => attempt.rating),
    ['hard'],
    'legacy hard feedback must survive normalization for older data',
  );
  assert.deepStrictEqual(
    normalized.items[2].attempts.map(attempt => attempt.rating),
    ['again'],
    'unknown rating values should still be dropped during normalization',
  );
}

// Settling: a finished catch-up run returns to the real calendar; an unfinished future sheet keeps its offset until it is completed and checked in.
{
  const [a, b] = TEST_WORDS.slice(4, 6);
  // Unfinished future task -> reload must NOT drop or replace it (no settle while catch-up is still running).
  resetState({ dailyGoal: 2, virtualOffset: 2 });
  seedSession([a, b], { date: __appTest.dateKey(__appTest.addDays(__appTest.realToday(), 2)) });
  assert.strictEqual(__appTest.state.session.items.length, 2, 'fixture should hold the future sheet');
  __appTest.reload();
  assert.strictEqual(__appTest.state.virtualOffset, 2, 'an unfinished future task must keep its study-day offset until it is checked in');
  const kept = __appTest.state.session;
  assert.strictEqual(kept.checkedIn, false, 'the in-progress catch-up sheet must survive a reload');
  assert.deepStrictEqual(kept.items.map(item => item.w).sort(), [a, b].sort(), 'reload must not replace the unfinished future sheet with today\'s sheet');

  // Checked-in future sheet -> next open settles to the real today and builds a fresh sheet there.
  resetState({ dailyGoal: 1, virtualOffset: 2 });
  const futureKey = __appTest.dateKey(__appTest.addDays(__appTest.realToday(), 2));
  seedSession([{ w: a, type: 'review' }], { date: futureKey, checkedIn: true, checkinDate: futureKey });
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'fixture should start with a checked-in future sheet');
  __appTest.reload();
  assert.strictEqual(__appTest.state.virtualOffset, 0, 'a settled timeline must return to the real calendar once catch-up is finished');
  assert.strictEqual(__appTest.state.session.date, __appTest.dateKey(), 'the next task sheet must be built on the real today after settling');
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'today must start as a fresh unchecked sheet');
}

// Streak follows real calendar days: catch-up sheets in one day count once; missing a real day resets.
{
  const [w1, w2] = TEST_WORDS.slice(2, 4);
  // A check-in on the day after the last real-day check-in extends the streak.
  resetState({ dailyGoal: 1 });
  seedSession([w1]);
  __appTest.state.streak = 5;
  __appTest.state.lastRealCheckin = __appTest.dateKey(__appTest.addDays(__appTest.realToday(), -1));
  __appTest.rate('good');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.streak, 6, 'checking in on consecutive real days should extend the streak');
  assert.strictEqual(__appTest.state.lastRealCheckin, __appTest.dateKey(), 'the real check-in day should be recorded');

  // A second study-day checked in within the same real day must not extend it twice.
  resetState({ dailyGoal: 1 });
  seedSession([w2]);
  __appTest.state.streak = 6;
  __appTest.state.lastRealCheckin = __appTest.dateKey(__appTest.addDays(__appTest.realToday(), -1));
  __appTest.rate('good');
  __appTest.checkIn();
  assert.strictEqual(__appTest.setStudyDate(__appTest.addDays(__appTest.effectiveDate(), 1), 'carry'), true, 'a checked-in sheet should open the next study day for catch-up');
  const tomorrowItems = __appTest.state.session.items;
  tomorrowItems.forEach(item => { item.initialDone = true; item.done = true; item.rating = 'good'; item.attempts.push({ rating: 'good', phase: 'initial', attemptNo: 1 }); });
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'the catch-up sheet should check in');
  assert.strictEqual(__appTest.state.streak, 7, 'multiple study days checked in within one real day must count as a single streak day');

  // Legacy state without lastRealCheckin restarts at one on the first new-code check-in.
  resetState({ dailyGoal: 1 });
  seedSession([w1]);
  __appTest.state.streak = 9;
  delete __appTest.state.lastRealCheckin;
  __appTest.rate('good');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.streak, 1, 'pre-migration streak data should restart cleanly instead of faking continuity');
}

// Same-day plan changes may replace untouched words, but must preserve any attempted word and its attempts.
{
  const outOfScope = VOCAB.find(word => word.src.includes('IELTS') && !word.src.includes('PTE'));
  assert.ok(outOfScope, 'the fixture needs an IELTS word outside PTE');
  const untouched = TEST_WORDS.find(word => word !== outOfScope.w);
  resetState({ dailyGoal: 2, decks: ['IELTS'] });
  seedSession([outOfScope.w, untouched]);
  __appTest.rate('hard');
  const attempts = __appTest.state.session.items.find(item => item.w === outOfScope.w).attempts;

  __appTest.state.dailyGoal = 1;
  __appTest.state.decks = ['PTE'];
  __appTest.state.excludeBasic = true;
  assert.strictEqual(__appTest.syncTodaySessionToPlan(), true, 'an unchecked sheet should accept a same-day plan change');
  __appTest.hydrateQueue();

  const retained = __appTest.state.session.items.find(item => item.w === outOfScope.w);
  assert.ok(retained, 'an attempted word should survive a scope change even when it is outside the new deck');
  assert.deepStrictEqual(retained.attempts, attempts, 'a scope change should preserve the complete attempt history');
  assert.strictEqual(retained.done, false, 'a difficult attempted word should remain queued for reinforcement');
  assert.strictEqual(__appTest.state.session.items.filter(item => item.type === 'new').length, 1, 'a smaller goal should remove only untouched future words');
  assert.strictEqual(new Set(__appTest.state.session.items.map(item => item.w)).size, __appTest.state.session.items.length, 'a plan change must not duplicate retained words');
}

// Carrying a task preserves attempts and appends newly due reviews in schema v2.
{
  const [attempted, newlyDue] = TEST_WORDS.slice(6, 8);
  resetState({ dailyGoal: 1 });
  seedSession([attempted]);
  __appTest.rate('hard');
  const target = __appTest.addDays(__appTest.realToday(), 2);
  __appTest.state.records[newlyDue] = {
    stage: 0,
    last: __appTest.dateKey(),
    dueDay: __appTest.dateKey(target),
  };

  assert.strictEqual(__appTest.setStudyDate(target, 'carry'), true, 'an unfinished task should carry to a later study date');
  const retained = __appTest.state.session.items.find(item => item.w === attempted);
  const appended = __appTest.state.session.items.find(item => item.w === newlyDue);
  assert.deepStrictEqual(retained.attempts.map(attempt => attempt.rating), ['hard'], 'carrying should preserve unresolved attempts');
  assert.ok(appended && appended.type === 'review', 'carrying should append reviews that become due by the target date');
  assert.strictEqual(appended.initialDone, false, 'an appended review should start a fresh initial pass');
  assert.strictEqual(appended.done, false, 'an appended review should start unresolved');
  assert.deepStrictEqual(appended.attempts, [], 'an appended review should use the schema-v2 attempts array');
  assert.strictEqual(new Set(__appTest.state.session.items.map(item => item.w)).size, __appTest.state.session.items.length, 'carrying should not duplicate words already on the sheet');
  assert.strictEqual(
    __appTest.setStudyDate(__appTest.addDays(__appTest.realToday(), -1), 'carry'),
    false,
    'a past calendar date should remain read-only history rather than becoming the active study day',
  );

  const carriedSession = __appTest.state.session;
  __appTest.rate('good');
  __appTest.rate('good');
  assert.strictEqual(__appTest.sessionReadyForCheckIn(), true, 'all carried and newly appended work should be clearable on the target day');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session, carriedSession, 'checking in a carried sheet must not immediately create a second sheet on the same day');
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'the carried sheet should remain visibly checked in');
  assert.strictEqual(__appTest.state.session.checkinDate, __appTest.dateKey(target), 'a carried sheet should record the actual target-day check-in date');
}

// Skipping must warn for attempted-but-unresolved work and archive its complete state without counting progress.
{
  const [attempted, untouched] = TEST_WORDS.slice(8, 10);
  resetState({ dailyGoal: 2 });
  seedSession([attempted, untouched]);
  __appTest.rate('again');
  const originalAttempts = __appTest.state.session.items[0].attempts;
  let confirmCalls = 0;
  const previousConfirm = global.confirm;
  global.confirm = () => { confirmCalls += 1; return true; };
  const target = __appTest.addDays(__appTest.realToday(), 1);
  assert.strictEqual(__appTest.setStudyDate(target, 'skip'), true, 'an unfinished sheet should support explicit skipping');
  global.confirm = previousConfirm;

  assert.strictEqual(confirmCalls, 1, 'skipping should warn when a word was attempted even if it is not yet cleared');
  assert.strictEqual(__appTest.state.skippedSessions.length, 1, 'skipping should archive the abandoned sheet');
  const archived = __appTest.state.skippedSessions[0].items.find(item => item.w === attempted);
  assert.strictEqual(archived.initialDone, true, 'the archive should preserve initial-pass completion');
  assert.strictEqual(archived.done, false, 'the archive should preserve unresolved status');
  assert.strictEqual(archived.rating, 'again', 'the archive should preserve the latest feedback');
  assert.deepStrictEqual(archived.attempts.map(attempt => attempt.rating), ['again'], 'the archive should preserve every attempt');
  assert.notStrictEqual(archived.attempts, originalAttempts, 'the skip archive should deep-copy attempts');
  assert.strictEqual(Object.keys(__appTest.state.records).length, 0, 'skipped attempts must not count as learned progress');
}

// Legacy unchecked difficult items migrate into reinforcement; checked-in legacy sessions stay closed.
{
  const word = TEST_WORDS[0];
  resetState();
  __appTest.state.session = {
    date: __appTest.dateKey(),
    checkedIn: false,
    items: [{ w: word, type: 'new', done: true, rating: 'hard' }],
  };
  __appTest.hydrateQueue();
  let migrated = __appTest.state.session.items[0];
  assert.strictEqual(migrated.initialDone, true, 'legacy hard feedback should count as an initial attempt');
  assert.strictEqual(migrated.done, false, 'an unchecked legacy hard item should reopen for reinforcement');
  assert.strictEqual(migrated.attempts[0].phase, 'initial', 'legacy feedback should be represented as an initial attempt');
  assert.strictEqual(migrated.attempts[0].rating, 'hard', 'legacy hard feedback should not be lost');
  assert.strictEqual(__appTest.currentItem().reinforcement, true, 'the migrated item should open directly in reinforcement mode');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'a migrated difficult item cannot bypass reinforcement');
  __appTest.rate('good');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, true, 'a migrated item should check in after a final good response');

  resetState();
  __appTest.state.session = {
    date: __appTest.dateKey(),
    checkinDate: __appTest.dateKey(),
    checkedIn: true,
    items: [{ w: word, type: 'new', done: true, rating: 'hard' }],
  };
  __appTest.hydrateQueue();
  migrated = __appTest.state.session.items[0];
  assert.strictEqual(migrated.done, true, 'normalization must not reopen a checked-in legacy session');
  __appTest.checkIn();
  assert.strictEqual(Object.keys(__appTest.state.records).length, 0, 'calling check-in on a legacy closed session should be a no-op');
}

// Eligibility must be based on canonical session items, not the filtered/rendered queue.
{
  const known = TEST_WORDS[1];
  resetState();
  seedSession([
    {
      w: known,
      type: 'new',
      initialDone: true,
      done: true,
      rating: 'good',
      attempts: [{ rating: 'good', phase: 'initial', attemptNo: 1 }],
    },
    {
      w: '__missing_dictionary_entry__',
      type: 'new',
      initialDone: false,
      done: false,
      rating: null,
      attempts: [],
    },
  ]);
  assert.deepStrictEqual(__appTest.q().map(item => item.w), [known], 'the rendered queue should omit a missing dictionary entry in this regression fixture');
  assert.ok(__appTest.q().every(item => item.done), 'the visible queue alone appears complete in the bypass regression fixture');
  assert.match(node('#emptyTitle').textContent, /任务数据需要修复/, 'a missing canonical word should show a blocking explanation instead of a blank workspace');
  __appTest.checkIn();
  assert.strictEqual(__appTest.state.session.checkedIn, false, 'a missing unresolved canonical item must still block check-in');
  assert.strictEqual(Object.keys(__appTest.state.records).length, 0, 'a filtered queue must not commit a partial sheet');
}

// Existing vocabulary, browsing, history recovery, and guide smoke coverage remains intact.
assert.ok(VOCAB.every(word => word.pos && word.meanings.length), 'every built-in word should have part-of-speech and meanings');
assert.strictEqual(VOCAB.length, 12881, 'the merged database should contain 12,880 generated words plus one curated-only entry');
assert.strictEqual(new Set(VOCAB.map(word => word.w.toLocaleLowerCase())).size, VOCAB.length, 'the full database must be unique by headword');
const pteWords = VOCAB.filter(word => word.src.includes('PTE'));
assert.strictEqual(pteWords.length, 570, 'the PTE Academic core should contain all 570 tracked AWL headwords');
assert.ok(pteWords.every(word => word.p), 'every PTE Academic headword should have phonetics');
assert.strictEqual(pteWords.filter(word => word.src.length === 1).length, 33, 'the PTE deck should add 33 unique headwords beyond the existing exam union');
assert.strictEqual(pteWords.filter(word => word.src.length > 1).length, 537, 'overlapping PTE words should merge into existing canonical entries');
const ptePlanWords = __appTest.selectedWords({ decks: ['PTE'], excludeBasic: false });
assert.strictEqual(ptePlanWords.length, 570, 'a PTE-only plan should expose all 570 tracked headwords');
assert.ok(ptePlanWords.every(word => word.src.includes('PTE')), 'a PTE-only plan should contain only PTE-tagged entries');

resetState({ dailyGoal: 1, decks: ['IELTS'], excludeBasic: true });
seedSession([TEST_WORDS[0]]);
__appTest.renderQueue();
assert.match(node('#queueList').innerHTML, /今日新词/, 'the standard queue should keep the current-new-word section label');
__appTest.renderLibrary();
assert.strictEqual((node('#libraryList').innerHTML.match(/class="library-row"/g) || []).length, 200, 'the library should render the first 200 rows for performance');
assert.match(node('#libraryStats').textContent, /12,881/, 'the library should report the merged unique count');
assert.match(node('#libraryStats').textContent, /PTE 570/, 'the library should report the PTE deck count');
const totalPages = Math.ceil(VOCAB.length / 200);
assert.match(node('#libraryFooter').innerHTML, new RegExp(`第 1 \\/ ${totalPages} 页`), 'the library should expose direct pagination');
node('#searchInput').value = 'resilient';
__appTest.renderLibrary();
assert.match(node('#searchResultMeta').textContent, /找到/, 'search should report its result count');
assert.match(node('#libraryList').innerHTML, /data-word="resilient"/, 'search should find exact English headwords');
node('#searchInput').value = '';
__appTest.renderLibrary();
__appTest.goToLibraryPage(totalPages, false);
assert.strictEqual((node('#libraryList').innerHTML.match(/class="library-row"/g) || []).length, VOCAB.length - (totalPages - 1) * 200, 'the last page should contain the remaining words');
assert.strictEqual(VOCAB.filter(__appTest.isBasicWord).length, 2380, 'basic words should follow zk/gk tags across all four decks');
assert.ok(__appTest.selectedWords({ decks: ['IELTS', 'TOEFL', 'GRE', 'PTE'], excludeBasic: true }).every(word => !__appTest.isBasicWord(word)), 'the plan should be able to exclude basic words');
__appTest.setLibraryFilter('PTE');
__appTest.goToLibraryPage(1, false);
assert.strictEqual((node('#libraryList').innerHTML.match(/class="library-row"/g) || []).length, 200, 'the PTE filter should expose a populated paginated deck');
assert.match(node('#searchResultMeta').textContent, /570/, 'the PTE filter should report all 570 results');
assert.strictEqual((node('#libraryList').innerHTML.match(/<span class="lib-tag">[^<]*PTE/g) || []).length, 200, 'every visible PTE-filtered row should display PTE membership');
__appTest.setLibraryFilter('ALL');

const legacy = {
  dailyGoal: 10,
  decks: ['IELTS'],
  excludeBasic: false,
  checkins: ['2026-01-01'],
  history: {},
  records: {},
  session: {
    checkedIn: true,
    checkinDate: '2026-01-01',
    date: '2026-01-01',
    items: [{ w: 'abate', type: 'new', rating: 'good' }],
  },
};
__appTest.recoverLegacyHistory(legacy);
assert.strictEqual(legacy.history['2026-01-01'].items[0].w, 'abate', 'legacy history should recover from a retained session');
assert.strictEqual(legacy.history['2026-01-01'].recoveredFrom, 'session', 'legacy recovery should declare its source');

const unspotted = VOCAB.find(word => word.w === 'unspotted');
__appTest.openWordPreview(unspotted);
assert.strictEqual(node('#wordPreviewDialog').open, true, 'library words should open in a standalone drawer');
assert.match(node('#wordPreviewContent').innerHTML, /释义关键词联想/, 'generated entries should explain their derived associations');
assert.ok(__appTest.relationWords(unspotted).length > 0, 'generated entries should link definition keywords when curated synonyms are unavailable');
__appTest.state.queueCollapsed = true;
__appTest.renderQueueLayout();
assert.ok(node('#studyWorkspace').classList.contains('queue-collapsed'), 'the daily queue should be collapsible');
__appTest.renderGuide();
assert.match(node('#guidePlanTitle').textContent, /每天 1 个新词/, 'the guide should summarize the active plan');

const home = fs.readFileSync('index.html', 'utf8');
assert.match(home, /BS 记忆法/, 'the guide should introduce the BS memory method naturally');
assert.match(home, /建立 · 强化/, 'the homepage headline should use a clean separator');
assert.doesNotMatch(home, /建立，再强化。/, 'the old punctuated headline should be removed');
assert.doesNotMatch(home, /BS 是这套学习节奏的名字/, 'the homepage should not explain the BS name as an aside');
assert.match(home, /data-filter="PTE"/, 'the library should expose a PTE filter');
assert.match(home, /name="deck" value="PTE" checked/, 'new plans should offer PTE Academic as a default deck');
assert.match(home, /不是 Pearson 官方词表/, 'the interface should distinguish the PTE academic core from an official Pearson list');
assert.match(home, /作者 <a[^>]+>落日七号<\/a>/, 'the guide should credit 落日七号 as the project author');
assert.match(home, /id="checkUpdateBtn"/, 'the guide should expose a manual update check');
assert.match(home, /id="updateStatus" role="status" aria-live="polite"/, 'update results should be announced accessibly');
assert.match(home, /github\.com\/luori7hao\/shici-memory\/releases/, 'the guide should keep a direct fallback link to release history');
assert.match(home, /id="downloadUpdateLink"/, 'the guide should provide a one-click download link for new releases');
assert.match(home, /id="reloadForUpdateBtn"/, 'the guide should provide a refresh shortcut for the Pages deployment');
assert.match(home, /id="pagesLink"[^>]*luori7hao\.github\.io\/shici-memory/, 'the guide should link to the online GitHub Pages deployment');
assert.match(home, /id="exportDataBtn"/, 'the plan page should offer a learning-progress export');
assert.match(home, /id="importDataBtn"/, 'the plan page should offer a learning-progress import');
assert.match(home, /id="importDataInput"[^>]*accept="application\/json,\.json"/, 'the import input should accept JSON backups');
assert.ok(home.indexOf('app-meta.js') < home.indexOf('app.js'), 'application metadata must load before the main script');

const packageMeta = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.strictEqual(APP_META.name, '拾词', 'application metadata should keep the product name');
assert.strictEqual(APP_META.author, '落日七号', 'application metadata should keep the requested author');
assert.strictEqual(APP_META.githubOwner, 'luori7hao', 'application metadata should target the requested GitHub account');
assert.strictEqual(APP_META.githubRepo, 'shici-memory', 'application metadata should target the release repository');
assert.strictEqual(APP_META.version, packageMeta.version, 'browser and release package versions must stay synchronized');
const releaseWorkflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
assert.match(releaseWorkflow, /tags:\s*\n\s*- 'v\*\.\*\.\*'/, 'version tags should trigger the release workflow');
assert.match(releaseWorkflow, /gh release create/, 'the release workflow should create a GitHub Release');
assert.match(releaseWorkflow, /sha256sum/, 'release downloads should include a SHA-256 checksum');
const pagesWorkflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
assert.match(pagesWorkflow, /branches:\s*\n\s*- main/, 'pushes to main should trigger the Pages deployment');
assert.match(pagesWorkflow, /node tests\/smoke\.js/, 'the Pages workflow must run the smoke tests before publishing');
assert.match(pagesWorkflow, /actions\/deploy-pages/, 'the Pages workflow should deploy through actions/deploy-pages');
assert.match(pagesWorkflow, /enablement: true/, 'the Pages workflow should enable Pages automatically on first deploy');

// Loading an old three-deck state must not silently opt an existing user into PTE.
localStorage.data = {};
localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState({ decks: ['IELTS', 'TOEFL', 'GRE'] })));
__appTest.reload();
assert.deepStrictEqual(__appTest.state.decks, ['IELTS', 'TOEFL', 'GRE'], 'legacy saved deck choices should remain unchanged until the user opts into PTE');

// Progress backups must round-trip through export and import across devices.
{
  resetState({ dailyGoal: 4 });
  seedSession([TEST_WORDS[0]]);
  __appTest.rate('good');
  __appTest.checkIn();
  const payload = __appTest.progressExportPayload();
  assert.strictEqual(payload.app, 'shici-memory', 'the backup payload should identify the application');
  assert.strictEqual(payload.key, STORAGE_KEY, 'the backup payload should record the storage key');
  assert.strictEqual(payload.version, APP_META.version, 'the backup payload should record the app version');
  assert.strictEqual(payload.data, __appTest.state, 'the backup payload should wrap the live learning state');
  const serialized = JSON.stringify(payload);

  resetState({ dailyGoal: 9 });
  assert.strictEqual(Object.keys(__appTest.state.records).length, 0, 'the fixture should restart from an empty state');
  const imported = __appTest.applyImportedProgress(__appTest.parseProgressImport(serialized));
  assert.strictEqual(Object.keys(imported.records).length, 1, 'importing a backup should restore learned records');
  assert.strictEqual(imported.dailyGoal, 4, 'importing a backup should restore the saved plan');
  assert.strictEqual(imported.checkins.length, 1, 'importing a backup should restore check-in history');
  assert.strictEqual(JSON.parse(localStorage.getItem(STORAGE_KEY)).dailyGoal, 4, 'an imported backup must be persisted to localStorage');
  assert.strictEqual(__appTest.state, imported, 'the live state should switch to the imported data');
  assert.strictEqual(__appTest.parseProgressImport(JSON.stringify(imported)).dailyGoal, 4, 'a raw state JSON should import without the wrapper');
  assert.throws(() => __appTest.parseProgressImport('not json'), /JSON/, 'invalid JSON should be rejected with a readable error');
  assert.throws(() => __appTest.parseProgressImport('{"foo":1}'), /备份/, 'unrelated JSON must not overwrite learning records');
  assert.throws(() => __appTest.parseProgressImport('[1,2,3]'), /备份/, 'array payloads must be rejected');
}

// Reveal-mode hides every answer until peeked, stays off for legacy data, and never leaks across presentations.
{
  const [first, second] = TEST_WORDS;
  // Legacy payloads without the key must load with reveal mode off via the defaults merge.
  localStorage.data[STORAGE_KEY] = JSON.stringify({ dailyGoal: 3, decks: ['IELTS'], excludeBasic: false, records: {}, checkins: [], history: {}, session: null });
  __appTest.reload();
  assert.strictEqual(__appTest.state.revealMode, false, 'legacy data without the key should load with reveal mode off');

  resetState();
  seedSession([first, second]);

  assert.strictEqual(__appTest.state.revealMode, false, 'reveal mode must default to off for existing users');
  assert.strictEqual(node('#wordSheet').classList.contains('masked'), false, 'the sheet should not be masked while reveal mode is off');

  __appTest.state.revealMode = true;
  __appTest.save();
  const sessionItem = __appTest.state.session.items[0];
  __appTest.renderWord(__appTest.currentItem());
  const sheetNode = node('#wordSheet');
  assert.strictEqual(sheetNode.classList.contains('masked'), true, 'enabling reveal mode should mask the current card immediately');
  assert.strictEqual(sheetNode.classList.contains('peek-open'), false, 'a fresh presentation must start fully hidden');
  assert.match(node('#peekBtn').textContent, /偷看释义/, 'the masked sheet should offer a peek action');
  assert.strictEqual(node('#ratingActions').classList.contains('hidden'), false, 'rating buttons stay actionable while the answers are hidden');

  node('#peekBtn').onclick();
  assert.strictEqual(sheetNode.classList.contains('peek-open'), true, 'peeking should reveal the answer zone');
  assert.strictEqual(node('#peekBtn').textContent, '收起', 'the peek control should become a collapse action after revealing');
  assert.strictEqual(sessionItem.peeks, 1, 'each reveal should persist a peek counter on the canonical session item');

  __appTest.renderWord(__appTest.currentItem());
  assert.strictEqual(sheetNode.classList.contains('masked'), true, 're-rendering keeps reveal mode active');
  assert.strictEqual(sheetNode.classList.contains('peek-open'), false, 'every new presentation must start hidden again without persisted peek state');
  node('#peekBtn').onclick();
  assert.strictEqual(sessionItem.peeks, 2, 'peeks on a later presentation should keep accumulating');

  __appTest.rate('good');
  assert.strictEqual(__appTest.currentItem().w, second, 'rating must work while the answers are hidden');
  assert.strictEqual(sheetNode.classList.contains('masked'), true, 'the next card starts masked as well');
  assert.strictEqual(sheetNode.classList.contains('peek-open'), false, 'the next card must not inherit a peeked state');

  resetState();
  __appTest.state.revealMode = true;
  seedSession([first], { checkedIn: true, checkinDate: __appTest.dateKey() });
  assert.strictEqual(node('#wordSheet').classList.contains('masked'), false, 'post-check-in review stays fully expanded regardless of the switch');
}

const response = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; },
});

(async () => {
  assert.strictEqual(__appTest.compareVersions('v1.10.0', '1.9.9'), 1, 'semantic versions must compare numerically');
  assert.strictEqual(__appTest.compareVersions('1.0.0', 'v1.0.0'), 0, 'an optional v prefix should not change a version');
  assert.strictEqual(__appTest.compareVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1, 'numeric prerelease identifiers should compare numerically');
  assert.strictEqual(__appTest.compareVersions('not-a-version', '1.0.0'), null, 'invalid release tags must not be treated as current');

  __appTest.renderProjectMeta();
  assert.strictEqual(node('#currentVersion').textContent, 'v' + APP_META.version, 'the guide should render the local application version');
  assert.strictEqual(node('#authorLink').textContent, '落日七号', 'the guide should render the project author from metadata');
  assert.strictEqual(node('#pagesLink').href, 'https://luori7hao.github.io/shici-memory/', 'the guide should link to the online GitHub Pages deployment');

  const learningStateBeforeUpdateChecks = localStorage.getItem(STORAGE_KEY);
  let requestCount = 0;
  let resolveRelease;
  const deferredFetch = () => {
    requestCount += 1;
    return new Promise(resolve => { resolveRelease = resolve; });
  };
  const firstCheck = __appTest.checkForUpdates(deferredFetch, { online: true, timeoutMs: 0 });
  const duplicateCheck = __appTest.checkForUpdates(deferredFetch, { online: true, timeoutMs: 0 });
  assert.strictEqual(firstCheck, duplicateCheck, 'repeated clicks should share the active update request');
  assert.strictEqual(node('#checkUpdateBtn').disabled, true, 'the update button should be disabled during a request');
  const [curMajor = '1', curMinor = '0'] = APP_META.version.split('.');
  const newerTag = `v${curMajor}.${Number(curMinor) + 1}.0`;
  const newestNoZipTag = `v${curMajor}.${Number(curMinor) + 2}.0`;
  const sameTag = `v${APP_META.version}`;
  resolveRelease(response(200, {
    tag_name: newerTag,
    html_url: `https://github.com/luori7hao/shici-memory/releases/tag/${newerTag}`,
    assets: [{ name: `shici-memory-${newerTag}.zip`, browser_download_url: `https://github.com/luori7hao/shici-memory/releases/download/${newerTag}/shici-memory-${newerTag}.zip` }],
  }));
  const available = await firstCheck;
  assert.strictEqual(requestCount, 1, 'a repeated click must not send another GitHub API request');
  assert.strictEqual(available.status, 'available', 'a newer semantic version should be reported');
  assert.match(node('#updateStatus').textContent, new RegExp(`发现新版本 ${newerTag}`), 'the guide should show the discovered version');
  assert.strictEqual(node('#latestReleaseLink').classList.contains('hidden'), false, 'a new version should reveal the latest-release link');
  assert.strictEqual(available.downloadUrl, `https://github.com/luori7hao/shici-memory/releases/download/${newerTag}/shici-memory-${newerTag}.zip`, 'an update with a packaged ZIP should expose its direct download URL');
  assert.strictEqual(node('#downloadUpdateLink').classList.contains('hidden'), false, 'a packaged new version should reveal the one-click download link');
  assert.strictEqual(node('#downloadUpdateLink').href, available.downloadUrl, 'the one-click link should point at the release ZIP asset');
  assert.strictEqual(node('#reloadForUpdateBtn').classList.contains('hidden'), true, 'the refresh shortcut should stay hidden outside GitHub Pages');
  assert.strictEqual(node('#checkUpdateBtn').disabled, false, 'the update button should recover after a request');

  const availableNoZip = await __appTest.checkForUpdates(
    async () => response(200, { tag_name: newestNoZipTag }),
    { online: true, timeoutMs: 0 },
  );
  assert.strictEqual(availableNoZip.status, 'available', 'a newer release without a ZIP asset should still be reported');
  assert.strictEqual(availableNoZip.downloadUrl, undefined, 'without a ZIP asset there is no direct download URL');
  assert.strictEqual(node('#downloadUpdateLink').classList.contains('hidden'), true, 'without a ZIP asset the download link should hide again');

  assert.strictEqual(__appTest.isPagesDeployment(), false, 'the Node test environment must not read as GitHub Pages');
  globalThis.location = { hostname: 'luori7hao.github.io' };
  const pagesUpdate = await __appTest.checkForUpdates(
    async () => response(200, { tag_name: newerTag, assets: [{ name: `shici-memory-${newerTag}.zip`, browser_download_url: 'https://example.invalid/shici-memory.zip' }] }),
    { online: true, timeoutMs: 0 },
  );
  assert.strictEqual(pagesUpdate.channel, 'pages', 'on GitHub Pages a newer release should switch to the refresh channel');
  assert.strictEqual(node('#reloadForUpdateBtn').classList.contains('hidden'), false, 'GitHub Pages should offer one-click refresh instead of a download');
  assert.strictEqual(node('#downloadUpdateLink').classList.contains('hidden'), true, 'GitHub Pages must not push a ZIP download');
  assert.match(node('#updateStatus').textContent, /立即刷新/, 'the Pages update message should point at the refresh action');
  delete globalThis.location;

  const current = await __appTest.checkForUpdates(
    async () => response(200, { tag_name: sameTag }),
    { online: true, timeoutMs: 0 },
  );
  assert.strictEqual(current.status, 'current', 'an equal GitHub release should report the app as current');
  assert.match(node('#updateStatus').textContent, /已是最新版/, 'the current-version message should be explicit');

  const invalid = await __appTest.checkForUpdates(
    async () => response(200, { tag_name: 'latest' }),
    { online: true, timeoutMs: 0 },
  );
  assert.strictEqual(invalid.status, 'invalid', 'a non-semver GitHub tag should not produce a false update result');

  const missing = await __appTest.checkForUpdates(async () => response(404), { online: true, timeoutMs: 0 });
  assert.strictEqual(missing.status, 'missing', 'a repository without a release should have a clear state');
  const limited = await __appTest.checkForUpdates(async () => response(403), { online: true, timeoutMs: 0 });
  assert.strictEqual(limited.status, 'limited', 'GitHub anonymous rate limits should have a clear state');

  let offlineRequests = 0;
  const offline = await __appTest.checkForUpdates(async () => { offlineRequests += 1; }, { online: false });
  assert.strictEqual(offline.status, 'offline', 'offline checks should return without contacting GitHub');
  assert.strictEqual(offlineRequests, 0, 'offline checks must not attempt a network request');
  assert.strictEqual(localStorage.getItem(STORAGE_KEY), learningStateBeforeUpdateChecks, 'update checks must never modify learning records');

  console.log('smoke test passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
