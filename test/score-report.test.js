'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../dec21-progress-merge.js');

const BUILD = 'dec21-20261016-hubert';
const FIXED_NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const FIXED_DATE = '2026-10-11';

function makeReporter(student, hooks) {
  const posts = [];
  const notes = [];
  const reporter = M.createDecodableScoreReporter({
    getStudent: function () { return student; },
    postScores: function (body) {
      posts.push(body);
      if (hooks && hooks.postScores) hooks.postScores(body);
    },
    noteScore: function (opts) {
      notes.push(opts);
      if (hooks && hooks.noteScore) hooks.noteScore(opts);
    },
    now: function () { return FIXED_NOW; }
  });
  return { reporter, posts, notes };
}

(function testDictationFourOfFive() {
  const { reporter, posts, notes } = makeReporter('zz_test_mrjmetrics');
  reporter.reportScore('mlr_dec_045', 'dictation', 4, 5, { missed: ['one'] }, { completed: true });
  assert.strictEqual(posts.length, 1);
  const ev = posts[0].events[0];
  assert.strictEqual(ev.item_id, 'mlr_dec_045:dictation');
  assert.strictEqual(ev.score_value, 4);
  assert.strictEqual(ev.score_max, 5);
  assert.strictEqual(ev.score_pct, 80);
  assert.strictEqual(ev.local_date, FIXED_DATE);
  assert.strictEqual(posts[0].student_email, 'zz_test_mrjmetrics');
  assert.strictEqual(posts[0].session_id, 'decodable-zz_test_mrjmetrics-' + FIXED_DATE);
  assert.strictEqual(notes.length, 1);
  assert.deepStrictEqual(notes[0], {
    program: 'decodable',
    itemId: 'mlr_dec_045:dictation',
    scoreValue: 4,
    scoreMax: 5,
    scorePct: 80,
    localDate: FIXED_DATE
  });
})();

(function testSpeakTenPagesAndSummary() {
  const { reporter, posts, notes } = makeReporter('zz_test_mrjmetrics');
  for (let i = 0; i < 10; i++) {
    const section = 'speak-p' + String(i + 1).padStart(2, '0');
    reporter.reportScore('mlr_dec_021', section, 80, 100, null, { completed: true });
  }
  reporter.reportScore('mlr_dec_021', 'speak', 800, 1000, { pages: 10 }, { completed: true });
  assert.strictEqual(notes.length, 11);
  const speakNote = notes[notes.length - 1];
  assert.strictEqual(speakNote.itemId, 'mlr_dec_021:speak');
  assert.strictEqual(speakNote.scoreValue, 800);
  assert.strictEqual(speakNote.scoreMax, 1000);
  assert.strictEqual(posts.length, 11);
})();

(function testSignedOutDoesNotPost() {
  let posts = 0;
  let notes = 0;
  const reporter = M.createDecodableScoreReporter({
    getStudent: function () { return ''; },
    postScores: function () { posts++; },
    noteScore: function () { notes++; }
  });
  const legacyStudent = 'zz_test_mrjmetrics';
  assert.ok(legacyStudent);
  reporter.reportScore('mlr_dec_045', 'dictation', 4, 5, null, { completed: true });
  assert.strictEqual(posts, 0);
  assert.strictEqual(notes, 0);
})();

(function testFailedSpeakAttemptCmOnly() {
  const { reporter, posts, notes } = makeReporter('zz_test_mrjmetrics');
  reporter.reportScore('mlr_dec_021', 'speak-p01', 42, 100, null, {
    completed: false,
    itemType: 'attempt',
    noteSSI: false
  });
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].events[0].item_type, 'attempt');
  assert.strictEqual(notes.length, 0);
})();

(function testIndexHtmlCacheBustMatchesBuild() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes("const MRJ_BUILD='" + BUILD + "'"));
  assert.ok(html.includes('content="' + BUILD + '"'));
  assert.ok(html.includes('dec21-progress-merge.js?v=' + BUILD));
  assert.ok(html.includes('pronounce/grade-browser.js?v=' + BUILD));
  assert.ok(!html.includes('mrj-decodable-try/pronounce/ort/'));
  assert.ok(!html.includes('mrj-decodable-try/pronounce/engine.js'));
})();

console.log('score-report: ok');
