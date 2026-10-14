import assert from 'assert';
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TEST_STUDENT = 'zz_test_mrjmetrics';
const SILENCE_WAV = join(root, 'test', 'bench-wavs', 'silence-0.5s.wav');
const WRONG_WAV = join(root, 'test', 'bench-wavs', 'wrong-noise.wav');

function mime(p) {
  const ext = extname(p);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = (req.url || '/').split('?')[0];
      const path = url === '/' ? '/index.html' : url;
      const file = join(root, path.replace(/^\//, ''));
      try {
        const st = statSync(file);
        if (!st.isFile()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(file) });
        res.end(readFileSync(file));
      } catch (e) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'pipe' });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code))));
  });
}

async function ensureWavs() {
  mkdirSync(join(root, 'test', 'bench-wavs'), { recursive: true });
  if (!existsSync(SILENCE_WAV)) {
    await runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=16000:cl=mono',
      '-t',
      '0.5',
      SILENCE_WAV,
    ]);
  }
  if (!existsSync(WRONG_WAV)) {
    await runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anoisesrc=d=0.8:c=pink:r=16000:a=0.3',
      WRONG_WAV,
    ]);
  }
}

async function mockAuth(page) {
  await page.addInitScript((student) => {
    localStorage.setItem('mrj-dec-student', student);
    window.MRJ_AUTH = {
      student: () => student,
      token: () => 'playwright-mock-token',
      signOut: () => localStorage.removeItem('mrj-dec-student'),
    };
  }, TEST_STUDENT);
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('script.google.com')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: false }),
      });
      return;
    }
    if (url.includes('mrjkorea.github.io/mrj-signin')) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* mock */' });
      return;
    }
    await route.continue();
  });
}

async function enterSpeakOnBook21(page) {
  await page.evaluate(async () => {
    const id = 'mlr_dec_021';
    const order = bookOrder();
    order.forEach((bid, i) => {
      if (i === 0 || bid === id) {
        setBookProg(bid, {
          passed: bid !== id,
          listen: true,
          song: true,
          read: true,
          dictation: true,
          speak: false,
        });
      }
    });
    pack = await (await fetch(BASE + 'assets/align_' + id + '.json?v=' + ASSET_V)).json();
    introDone = true;
    sayPage = 0;
    setMode('speak');
  });
  await page.waitForSelector('#sayLine', { timeout: 15000 });
}

async function mockDoorFailGrader(page) {
  await page.evaluate(() => {
    window.MRJPronounce = {
      load: async () => true,
      grade: async () => ({
        doorFail: true,
        reason: 'Say the sentence again, please. Say each word clearly.',
        overall: { score: 0, band: 'fail' },
        words: [],
        model_id: 'mock',
        meta: { scoring_mode: 'citrinet-only' },
      }),
    };
  });
}

async function waitMicReady(page) {
  await page.waitForFunction(() => {
    const mic = document.getElementById('sayLine');
    return mic && !mic.disabled;
  });
}

async function tapMicUntilNext(page, maxPresses = 5) {
  for (let i = 0; i < maxPresses; i++) {
    await waitMicReady(page);
    await page.click('#sayLine');
    await page.waitForTimeout(250);
    const stop = page.locator('#sayStop:not(.hidden)');
    if (await stop.isVisible()) await stop.click();
    await page.waitForFunction(
      () => {
        const st = document.getElementById('speakStatus');
        return st && !/Listening|Hearing you/i.test(st.textContent || '');
      },
      { timeout: 15000 },
    );
    const visible = await page.locator('#sayNext:not(.hidden)').isVisible();
    if (visible) return { presses: i + 1, nextVisible: true };
  }
  const nextVisible = await page.locator('#sayNext:not(.hidden)').isVisible();
  return { presses: maxPresses, nextVisible };
}

const { server, base } = await startStaticServer();
await ensureWavs();

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${SILENCE_WAV}`,
  ],
});

try {
  const page = await browser.newPage();
  await mockAuth(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const lib = document.getElementById('libStage');
    return lib && !lib.classList.contains('hidden');
  }, { timeout: 20000 });

  await mockDoorFailGrader(page);
  await enterSpeakOnBook21(page);
  const door = await tapMicUntilNext(page, 5);
  assert.ok(door.nextVisible, 'Next visible after 5 doorFail mic attempts');
  console.log('doorFail path:', door);

  await page.close();

  const page2 = await browser.newPage({
    viewport: { width: 390, height: 800 },
  });
  await mockAuth(page2);
  await page2.goto(base, { waitUntil: 'domcontentloaded' });
  await page2.waitForFunction(() => {
    const lib = document.getElementById('libStage');
    return lib && !lib.classList.contains('hidden');
  }, { timeout: 20000 });
  await enterSpeakOnBook21(page2);

  const line = await page2.evaluate(() => {
    const p = pack.pages[sayPage];
    return sayTarget(p.text);
  });

  for (let i = 0; i < 5; i++) {
    await waitMicReady(page2);
    await page2.click('#sayLine');
    await page2.waitForTimeout(250);
    const stop = page2.locator('#sayStop:not(.hidden)');
    if (await stop.isVisible()) await stop.click();
    await page2.waitForFunction(
      () => {
        const st = document.getElementById('speakStatus');
        return st && !/Listening|Hearing you|Checking your speaking/i.test(st.textContent || '');
      },
      { timeout: 120000 },
    );
  }
  const live = await page2.evaluate((sayLine) => ({
    next: !document.getElementById('sayNext').classList.contains('hidden'),
    tries: sayTries,
    mic: sayMicPresses,
    status: document.getElementById('speakStatus').textContent,
    line: sayLine,
  }), line);
  assert.ok(live.next, `live grader: Next visible (${live.status})`);
  assert.ok(live.tries >= 5 || live.mic >= 5, `tries/mic: ${live.tries}/${live.mic}`);
  console.log('live citrinet path:', live);

  console.log('playwright say-max-tries: ok');
} finally {
  await browser.close();
  server.close();
}
