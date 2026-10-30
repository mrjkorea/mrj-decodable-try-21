'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('index.html');
const lib = JSON.parse(read('assets/decodable_library.json'));
const readme = read('assets/decodable/letter_intro/README.md');

// Data: each book names one mp4, and the book JSON, LETTER_INTRO and README agree.
const mapBlock = html.match(/const LETTER_INTRO=\{([\s\S]*?)\};/);
assert.ok(mapBlock, 'LETTER_INTRO fallback map required');
const fallback = Object.fromEntries([...mapBlock[1].matchAll(/(mlr_dec_\d{3}):'([^']+)'/g)].map((m) => [m[1], m[2]]));
assert.deepStrictEqual(Object.keys(fallback), lib.books.map((b) => b.id), 'LETTER_INTRO covers exactly the library books');
const missing = [];
for (const book of lib.books) {
  const intros = JSON.parse(read('assets/' + book.align)).letter_intros;
  assert.ok(Array.isArray(intros) && intros.length === 1, `${book.id}: one letter_intros entry`);
  const file = intros[0];
  assert.match(file, /^[a-z0-9_]+_letter_intro\.mp4$/, `${book.id}: mp4 name`);
  assert.strictEqual(fallback[book.id], file, `${book.id}: LETTER_INTRO must match ${book.align}`);
  assert.ok(readme.includes('`' + file + '`'), `${book.id}: README lists ${file}`);
  if (!fs.existsSync(path.join(root, 'assets/decodable/letter_intro', file))) missing.push(file);
}
if (process.argv.includes('--media')) assert.deepStrictEqual(missing, [], 'letter-intro mp4s missing on disk');

// Flow: run the app script against a small fake DOM and walk the intro.
const els = new Map();
class El {
  constructor(id, tag) {
    this.id = id;
    this.tagName = tag;
    this.kids = [];
    this.html = '';
    this.textContent = '';
    this.disabled = false;
    this.style = {};
    const cls = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, on) => ((on === undefined ? !cls.has(c) : on) ? (cls.add(c), true) : (cls.delete(c), false)),
      contains: (c) => cls.has(c),
    };
  }
  get innerHTML() { return this.html; }
  set innerHTML(v) {
    this.kids.forEach((id) => els.delete(id));
    this.html = String(v);
    this.kids = [];
    for (const m of this.html.matchAll(/<(\w+)\b([^>]*)>/g)) {
      const id = (m[2].match(/\bid="([^"]+)"/) || [])[1];
      if (!id) continue;
      const el = m[1] === 'video' ? new Video(id, (m[2].match(/\bsrc="([^"]+)"/) || [])[1]) : new El(id, m[1]);
      els.set(id, el);
      this.kids.push(id);
    }
  }
  querySelectorAll() { return []; }
  before() {}
}
class Video extends El {
  constructor(id, src) {
    super(id, 'video');
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
class FakeAudio {
  constructor(src) { this.src = src; }
  play() { return Promise.resolve(); }
  pause() {}
}
const body = html.slice(html.indexOf('<body'), html.indexOf('<script'));
for (const m of body.matchAll(/\bid="([^"]+)"/g)) els.set(m[1], new El(m[1], 'div'));

const store = new Map([['mrj-dec-student', 'zz_test_mrjmetrics']]);
const warns = [];
const ctx = {
  document: {
    getElementById: (id) => els.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => new El('', tag),
    addEventListener() {},
  },
  location: { pathname: '/', hostname: 'localhost', protocol: 'http:', port: '', search: '' },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  fetch: (url) => {
    const m = String(url).match(/assets\/(align_mlr_dec_\d{3}\.json)/);
    if (!m) return new Promise(() => {}); // park boot(); the test sets lib and i18n itself
    return Promise.resolve({ json: async () => JSON.parse(read('assets/' + m[1])) });
  },
  Audio: FakeAudio,
  console: { log() {}, error: console.error, warn: (...a) => warns.push(a.join(' ')) },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  DEC21_PROGRESS_MERGE: require('../dec21-progress-merge.js'),
  __lib: lib,
  __i18n: JSON.parse(read('assets/decodable_i18n.json')),
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(html.match(/<script>\n(const MRJ_BUILD[\s\S]*?)<\/script>/)[1], ctx);
const run = (code) => vm.runInContext(code, ctx);
run('lib=__lib; i18n=__i18n;');

const $ = (id) => els.get(id);
const step = () => run('introStep');
const video = () => $('letterIntroVid');
const reported = (id) => [...run(`bookProg('${id}').reported`)];

(async function testIntroFlow() {
  await run("openBook('mlr_dec_021')");
  assert.strictEqual(step(), 'cousin');
  assert.strictEqual($('modeBadge').textContent, 'QU', 'sound card first');

  run('introAdvance()');
  assert.strictEqual(step(), 'letter-intro', 'cousin -> letter-intro');
  assert.ok($('introStage').classList.contains('letter-intro'), 'full-bleed layout on');
  assert.match(video().src, /^\/assets\/decodable\/letter_intro\/qu_letter_intro\.mp4\?v=/);
  assert.ok(!video().paused, 'video plays');
  assert.ok($('introGo').disabled, 'Next locked while the video plays');
  run('introAdvance()');
  assert.strictEqual(step(), 'letter-intro', 'cannot advance before the video ends');

  video().onended();
  assert.ok(!$('introGo').disabled, 'Next opens when the video ends');
  assert.ok(reported('mlr_dec_021').includes('letter-intro'), "reportIntroStep('letter-intro')");

  run('introAdvance()');
  assert.strictEqual(step(), 'famous-card', 'letter-intro -> famous-card');
  assert.ok(!$('introStage').classList.contains('letter-intro'), 'full-bleed layout off');

  run('testBackIntro()');
  assert.strictEqual(step(), 'letter-intro', 'back: famous-card -> letter-intro');
  assert.ok($('introGo').disabled, 'gate re-arms on the way back');
  run('testBackIntro()');
  assert.strictEqual(step(), 'cousin', 'back: letter-intro -> cousin');
  run('testBackIntro()');
  assert.strictEqual(run('mode'), 'library', 'back: cousin -> library');

  await run("openBook('mlr_dec_021')");
  run('introAdvance()');
  video().onended();
  run('introAdvance()');
  run('introAdvance()');
  assert.strictEqual(step(), 'famous', 'famous-card -> famous');
  const carpet = $('carpetVid');
  carpet.currentTime = 6.3;
  carpet.ontimeupdate();
  run('audio.onended()');
  carpet.currentTime = 10;
  carpet.onended();
  run('introAdvance()');
  assert.strictEqual(step(), 'chase', 'famous -> chase');
  $('chaseVid').currentTime = 10;
  $('chaseVid').onended();
  assert.strictEqual(run('mode'), 'listen', 'chase -> Listen');
  assert.strictEqual(run('introDone'), true);

  run("setBookProg('mlr_dec_021',{passed:true})");
  await run("openBook('mlr_dec_022')");
  run('introAdvance()');
  const playing = video();
  assert.match(playing.src, /\/v_letter_intro\.mp4\?v=/);
  run('showLib()');
  assert.ok(playing.paused, 'leaving the screen pauses the narration');

  await run("openBook('mlr_dec_022')");
  run('introAdvance()');
  video().onerror();
  assert.ok(!$('introGo').disabled, 'a missing video never traps the student');
  assert.ok(warns.some((w) => w.includes('letter intro video missing')), 'missing video is logged');
  assert.ok(!reported('mlr_dec_022').includes('letter-intro'), 'no completion report without the video');
  run('introAdvance()');
  assert.strictEqual(step(), 'famous-card');

  await run("openBook('mlr_dec_022')");
  run('delete pack.letter_intros; introAdvance()');
  assert.match(video().src, /\/v_letter_intro\.mp4\?v=/, 'LETTER_INTRO fallback when the book JSON has no letter_intros');

  run("pack.book_id='mlr_dec_099'; introStep='cousin'; showIntro()");
  assert.strictEqual(step(), 'famous-card', 'no sound card, letters or intro: straight to famous-card');

  console.log(`letter-intro: ok (${lib.books.length} books, ${lib.books.length - missing.length} mp4s on disk)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
