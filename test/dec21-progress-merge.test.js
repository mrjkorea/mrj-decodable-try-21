'use strict';

const assert = require('assert');
const M = require('../dec21-progress-merge.js');

(function testMergeBoolsAndScores() {
  const a = { passed: false, listen: true, dictScore: 70, readPages: { '0': true } };
  const b = { passed: true, song: true, dictScore: 85, readPages: { '1': true } };
  const m = M.mergeBookProgress(a, b);
  assert.strictEqual(m.passed, true);
  assert.strictEqual(m.listen, true);
  assert.strictEqual(m.song, true);
  assert.strictEqual(m.dictScore, 85);
  assert.strictEqual(m.readPages['0'], true);
  assert.strictEqual(m.readPages['1'], true);
})();

(function testSpeakPagesMax() {
  const m = M.mergeBookProgress({ speakPages: { '0': 60, '1': 90 } }, { speakPages: { '0': 80 } });
  assert.strictEqual(m.speakPages['0'], 80);
  assert.strictEqual(m.speakPages['1'], 90);
})();

(function testUnparseablePack() {
  const p = M.parsePackBooks('{not json');
  assert.strictEqual(p.ok, true);
  assert.deepStrictEqual(p.books, {});
  assert.strictEqual(p.unparseable, true);
})();

(function testSaveGating() {
  const gate = M.createPackSaveGate();
  assert.strictEqual(gate.requestSave().sent, false);
  gate.beginLoad();
  assert.strictEqual(gate.requestSave().queued, true);
  gate.finishLoadOk();
  assert.strictEqual(gate.requestSave().sent, true);
  gate.finishLoadFail();
  assert.strictEqual(gate.maySave(), false);
})();

(function testNeverReadsSharedLegacyKey() {
  const legacyPayload = JSON.stringify({
    byStudent: {
      alice: { mlr_dec_021: { passed: true, listen: true } },
      bob: { mlr_dec_022: { passed: true, listen: true } }
    }
  });
  const aliceOnly = JSON.stringify({
    byStudent: { alice: { mlr_dec_023: { listen: true } } }
  });
  const store = { [M.SHARED_DEVICE_KEY]: legacyPayload, [M.studentProgressKey('alice')]: aliceOnly };
  const keysRead = [];
  const data = M.loadStudentProgressStore(function (key) {
    keysRead.push(key);
    return store[key];
  }, 'alice');
  assert.strictEqual(keysRead.length, 1);
  assert.strictEqual(keysRead[0], M.studentProgressKey('alice'));
  assert.ok(!keysRead.includes(M.SHARED_DEVICE_KEY));
  assert.deepStrictEqual(data.byStudent.alice.mlr_dec_023, { listen: true });
  assert.strictEqual(data.byStudent.alice.mlr_dec_021, undefined);
})();

(function testDecodableScoreItemId() {
  assert.strictEqual(M.decodableScoreItemId('mlr_dec_021', 'listen'), 'mlr_dec_021:listen');
  assert.strictEqual(M.decodableScoreItemId('mlr_dec_040', 'passed'), 'mlr_dec_040:passed');
  assert.strictEqual(M.decodableScoreItemId('mlr_dec_021', 'mlr_dec_021:dictation'), 'mlr_dec_021:dictation');
})();

(function testReloadSavedSessionOpensLibraryOnce() {
  const c = M.createLibraryBootCoordinator();
  assert.strictEqual(c.onAuthReady(true), false, 'auth-ready before assets must not open yet');
  assert.strictEqual(c.markAssetsReady(), true, 'assets ready after saved session should open');
  assert.strictEqual(c.markAssetsReady(), false, 'second mark must not reopen');
  assert.strictEqual(c.onAuthReady(true), false, 'duplicate auth-ready must not reopen');
})();

(function testAuthReadyAfterAssets() {
  const c = M.createLibraryBootCoordinator();
  assert.strictEqual(c.markAssetsReady(), false, 'no student yet');
  assert.strictEqual(c.onAuthReady(true), true, 'sign-in after load should open');
  assert.strictEqual(c.onAuthReady(true), false, 'only once');
})();

(function testUploadNeverIncludesLegacyMix() {
  const studentStore = {
    byStudent: { alice: { mlr_dec_023: { listen: true } } }
  };
  const legacyOnly = {
    byStudent: {
      alice: { mlr_dec_021: { passed: true } },
      bob: { mlr_dec_022: { passed: true } }
    }
  };
  const upload = JSON.parse(M.progressUploadJson(studentStore, 'alice'));
  assert.deepStrictEqual(upload.books, { mlr_dec_023: { listen: true } });
  const poisoned = JSON.parse(M.progressUploadJson(legacyOnly, 'alice'));
  assert.ok(!poisoned.books.mlr_dec_022);
  assert.deepStrictEqual(poisoned.books, { mlr_dec_021: { passed: true } });
})();

console.log('dec21-progress-merge: ok');
