import assert from 'assert';
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const wavPath = join(root, 'test', 'bench-wavs', 'correct-it-is-here.wav');
const PRONOUNCE_TRY = 'https://mrjkorea.github.io/pronounce-try/';
const SENTENCE = 'It is here.';

function mime(p) {
  const ext = extname(p);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
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

async function ensureBenchWav() {
  mkdirSync(join(root, 'test', 'bench-wavs'), { recursive: true });
  if (existsSync(wavPath)) return;
  const mp3 = join(root, 'test', 'bench-wavs', 'it-is-here.mp3');
  if (!existsSync(mp3)) {
    const buf = await fetch(PRONOUNCE_TRY + 'audio/hear/it-is-here.mp3').then((r) => r.arrayBuffer());
    writeFileSync(mp3, Buffer.from(buf));
  }
  await runFfmpeg(['-y', '-i', mp3, '-ar', '16000', '-ac', '1', wavPath]);
}

const { server, base } = await startStaticServer();
await ensureBenchWav();

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
  ],
});

const report = { base, fakeMic: wavPath, timings: {} };

try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ path: join(root, 'pronounce', 'audio.js') });
  await page.addScriptTag({ path: join(root, 'pronounce', 'grade-browser.js') });

  const tLoad0 = Date.now();
  await page.evaluate(async (origin) => {
    window.MRJPronounce.setBase(origin);
    await window.MRJPronounce.load();
  }, PRONOUNCE_TRY);
  report.timings.loadMs = Date.now() - tLoad0;

  const graded = await page.evaluate(async ({ wavUrl, sentence }) => {
    const blob = await fetch(wavUrl).then((r) => r.blob());
    return window.__mrjDecodablePronounceBench(blob, sentence);
  }, { wavUrl: PRONOUNCE_TRY + 'audio/hear/it-is-here.mp3', sentence: SENTENCE });

  report.graded = {
    trialMode: graded.trialMode,
    pass: graded.result.pass,
    scorePct: graded.result.scorePct,
    scoring_mode: graded.result.meta && graded.result.meta.scoring_mode,
    benchMs: Math.round(graded.ms),
    perf: graded.perf,
  };

  assert.strictEqual(graded.trialMode, 'citrinet-only');
  assert.strictEqual(graded.result.meta.scoring_mode, 'citrinet-only');
  assert.ok(graded.result.pass, 'expected pass on reference clip');
  console.log('citrinet-bench: ok');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
