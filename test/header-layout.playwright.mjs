import assert from 'assert';
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TEST_STUDENT = 'zz_test_mrjmetrics';

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
      const port = server.address().port;
      resolve({ server, base: `http://127.0.0.1:${port}/` });
    });
  });
}

async function mockAuth(page) {
  await page.addInitScript((student) => {
    localStorage.setItem('mrj-dec-student', student);
    window.MRJ_AUTH = {
      student: () => student,
      token: () => 'playwright-mock-token',
      signOut: () => {
        localStorage.removeItem('mrj-dec-student');
      }
    };
  }, TEST_STUDENT);
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('script.google.com')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: false })
      });
      return;
    }
    if (url.includes('mrjkorea.github.io/mrj-signin') || url.includes('mrjkorea.github.io/mrj-decodable-try/pronounce')) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* mock */' });
      return;
    }
    await route.continue();
  });
}

async function headerPositions(page) {
  const sel = ['#langPick', '#btnLibrary', '[data-mrj-name-pill]', '#btnSwitch'];
  const out = {};
  for (const s of sel) {
    const box = await page.locator(s).boundingBox();
    out[s] = box
      ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }
      : null;
  }
  const doc = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }));
  out.noHorizontalScroll = doc.scrollW <= doc.clientW + 1;
  return out;
}

const widths = [360, 390, 414, 1280];
const table = [];

const { server, base } = await startStaticServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    await mockAuth(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const lib = document.getElementById('libStage');
      return lib && !lib.classList.contains('hidden');
    }, { timeout: 15000 });
    const title = await page.title();
    assert.ok(title.includes('Books 21-40'), `title at ${w}px: ${title}`);
    const badge = await page.locator('#modeBadge').textContent();
    assert.ok(badge && badge.includes('21-40'), `badge at ${w}px: ${badge}`);
    const pos = await headerPositions(page);
    assert.ok(pos.noHorizontalScroll, `horizontal scroll at ${w}px`);
    table.push({ width: w, ...pos });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const lib = document.getElementById('libStage');
      return lib && !lib.classList.contains('hidden');
    }, { timeout: 15000 });
    await page.close();
  }
  console.log('playwright header-layout: ok');
  console.log(JSON.stringify(table, null, 2));
} finally {
  await browser.close();
  server.close();
}
