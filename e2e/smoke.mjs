// Headless E2E smoke test for Modern Roulette.
//   pnpm dev   (one terminal)      pnpm e2e   (another)
// Env: BASE_URL (default http://localhost:5177/), CHROME_PATH (default /usr/bin/google-chrome),
//      E2E_GPU=0 for software rendering (skips the FPS assertion).
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5177/';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
const GPU = process.env.E2E_GPU !== '0';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', ...(GPU ? ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] : [])],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}?seed=e2e&inspector=1&landing=1600&hold=1500&latency=60-120`, { waitUntil: 'networkidle0' });
await page.waitForSelector('.wheel__canvas');
await sleep(500);

// ------------------------------------------------------------ helpers
const state = () => page.$eval('.chain .pill.is-active', (e) => e.textContent);
const waitState = async (want, ms = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (want.includes(await state())) return true;
    await sleep(40);
  }
  return false;
};
const num = (sel) => page.$eval(sel, (e) => Number(e.dataset.value));
const stake = () => num('[data-testid="stake"]');
const balance = () => num('[data-testid="balance"]');
const click = async (sel) => {
  await page.click(sel);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
};
const spot = (id) => click(`.felt [data-spot="${id}"]:not(.stack)`);
const select = async (testid, value) => {
  await page.select(`[data-testid="${testid}"]`, value);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
};

// ------------------------------------------------------------ 1. boot
check('app boots with the wheel canvas and no console errors', errors.length === 0 && (await page.$('.wheel__canvas')) !== null, errors.join(' | '));
const canvasPainted = await page.$eval('.wheel__canvas', (c) => {
  const g = c.getContext('2d');
  const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.2), 1, 1).data;
  return c.width > 100 && d[3] > 0;
});
check('wheel canvas is high-DPI sized and painted', canvasPainted);
check('starts in BETTING with €1,000.00', (await state()) === 'BETTING' && (await balance()) === 100000);

// ------------------------------------------------------------ 2. hover / focus preview
await page.hover('.felt [data-spot="corner:17"]');
await sleep(120);
let covered = await page.$$eval('.cell.is-covered', (els) => els.map((e) => e.textContent).sort());
let preview = await page.$eval('[data-testid="preview"]', (e) => e.textContent);
check('corner hover highlights exactly 17·18·20·21', JSON.stringify(covered) === JSON.stringify(['17', '18', '20', '21']), covered.join(','));
check('preview shows kind, odds and coverage', /Corner/.test(preview) && /8:1/.test(preview) && /4\/37/.test(preview), preview);
await page.hover('.felt [data-spot="split:0-2"]');
await sleep(80);
covered = await page.$$eval('.cell.is-covered', (els) => els.map((e) => e.textContent).sort());
check('zero split hover covers 0 and 2', JSON.stringify(covered) === JSON.stringify(['0', '2']), covered.join(','));
await page.hover('.felt [data-spot="dozen:2"]');
await sleep(80);
preview = await page.$eval('[data-testid="preview"]', (e) => e.textContent);
check('outside hover previews dozen at 2:1', /2nd dozen/.test(preview) && /2:1/.test(preview) && /12\/37/.test(preview), preview);
await page.focus('.felt [data-spot="straight:7"]');
preview = await page.$eval('[data-testid="preview"]', (e) => e.textContent);
check('keyboard focus also previews a spot', /Straight 7/.test(preview) && /35:1/.test(preview), preview);
await page.mouse.move(5, 5);

// ------------------------------------------------------------ 3. chips, undo, clear, double
await click('[data-testid="chip-500"]');
await spot('straight:17');
await spot('red');
await spot('red');
check('chips stack on spots and total bet sums', (await stake()) === 1500);
await click('[data-testid="undo"]');
check('undo removes the last chip', (await stake()) === 1000);
await click('[data-testid="clear"]');
check('clear empties the felt', (await stake()) === 0 && (await page.$$('[data-testid="stack"]')).length === 0);
await click('[data-testid="undo"]');
check('clear itself is undoable', (await stake()) === 1000);
await click('[data-testid="double"]');
check('2× doubles every stake', (await stake()) === 2000);
await page.click('.felt [data-spot="split:17-20"]', { button: 'right' });
check('right-click on an empty spot is rejected with a notice', (await stake()) === 2000 && (await page.$('[data-testid="toast"]')) !== null);

// ------------------------------------------------------------ 4. a full round (forced 17)
await select('force', '17');
await page.keyboard.press('Space');
const held = await balance();
check('Space spins; stake is held while the wheel turns', (await waitState(['REQUESTING', 'SPINNING'], 2000)) && held === 98000, `balance ${held}`);
const roundId = await page.$eval('[data-testid="round-id"]', (e) => e.textContent);
await page.keyboard.press('Space');
await click('[data-testid="spin"]').catch(() => {});
await spot('black').catch(() => {});
check('double spin and late bets are rejected mid-round', (await page.$eval('[data-testid="round-id"]', (e) => e.textContent)) === roundId && (await stake()) === 2000);
await waitState(['SPINNING'], 4000);
check('balance is not revealed while the ball is in motion', (await balance()) === 98000);
const landed = await waitState(['RESULT'], 8000);
await sleep(300);
const resultNumber = await page.$eval('[data-testid="result"]', (e) => e.dataset.number);
check('ball settles and the round reaches RESULT on 17', landed && resultNumber === '17', `number ${resultNumber}`);
const under = await page.$eval('[data-testid="under-ball"]', (e) => e.textContent);
const phase = await page.$eval('[data-testid="wheel-phase"]', (e) => e.textContent);
check('renderer resolver agrees: pocket under the ball is 17', under === '17' && phase === 'seated', `${phase} / ${under}`);
check('settlement: straight 17 pays 35:1, red loses → €1,340.00', (await balance()) === 134000, String(await balance()));
check('winning cell and winning stack are marked; losing stack fades', (await page.$('.cell.is-winner[data-spot="straight:17"]')) !== null && (await page.$('.stack.is-won[data-spot="straight:17"]')) !== null && (await page.$('.stack.is-lost[data-spot="red"]')) !== null);
check('history strip shows 17 first', (await page.$eval('[data-testid="history"] li', (e) => e.textContent)) === '17');
await page.screenshot({ path: `${OUT}/desktop-result.png` });

// ------------------------------------------------------------ 5. next round + rebet
check('result hold reopens betting with a clear felt', (await waitState(['BETTING'], 4000)) && (await stake()) === 0);
await click('[data-testid="rebet"]');
check('rebet restores the previous round', (await stake()) === 2000);

// ------------------------------------------------------------ 6. network failure → dismiss
await select('next-failure', 'network');
await click('[data-testid="spin"]');
check('network failure shows the error dialog', (await waitState(['ERROR'], 4000)) && (await page.$('.error-dialog [data-testid="dismiss"]')) !== null);
const footerAlign = await page.$eval('.error-dialog .sheet__footer', (f) => {
  const fr = f.getBoundingClientRect();
  const last = f.lastElementChild.getBoundingClientRect();
  return { primaryLast: f.lastElementChild.classList.contains('btn--primary'), gap: Math.round(fr.right - last.right) };
});
check('dialog primary action is right-aligned', footerAlign.primaryLast && footerAlign.gap <= 32, JSON.stringify(footerAlign));
await sleep(500);
await page.screenshot({ path: `${OUT}/error-dialog.png` });
await click('[data-testid="dismiss"]');
await waitState(['BETTING'], 3000);
await sleep(300);
check('dismiss keeps bets and charges nothing', (await stake()) === 2000 && (await balance()) === 134000);

// ------------------------------------------------------------ 7. timeout after commit → idempotent retry
await select('next-failure', 'timeout');
await click('[data-testid="spin"]');
await waitState(['ERROR'], 4000);
check('timeout cannot be dismissed, only confirmed', (await page.$('[data-testid="dismiss"]')) === null && (await page.$('[data-testid="retry"]')) !== null);
await click('[data-testid="retry"]');
await waitState(['RESULT'], 9000);
const json = JSON.parse(await page.$eval('[data-testid="outcome-json"]', (e) => e.textContent));
check('retry replays the committed round exactly once', json.replayed === true && (await balance()) === 168000, `replayed=${json.replayed} balance=${await balance()}`);

// ------------------------------------------------------------ 8. spin again from RESULT
await page.keyboard.press('Space');
check('Space on a result spins again with the same bets', (await waitState(['REQUESTING', 'SPINNING'], 2000)) && (await stake()) === 2000);
await waitState(['RESULT'], 8000);
await select('force', '');

// ------------------------------------------------------------ 9. limits, chips, keyboard
await waitState(['BETTING'], 4000);
await page.keyboard.press('5');
check('number keys select chips', (await page.$eval('[data-testid="chip-50000"]', (e) => e.getAttribute('aria-checked'))) === 'true');
await spot('straight:0');
const zeroStack = await page.$eval('.stack[data-spot="straight:0"]', (e) => Number(e.dataset.amount));
const toast = await page.$eval('[data-testid="toast"]', (e) => e.textContent).catch(() => '');
check('a chip over the spot limit is capped at €100 with a notice', zeroStack === 10000 && /Capped/.test(toast), `${zeroStack} ${toast}`);
await page.keyboard.down('Control');
await page.keyboard.press('z');
await page.keyboard.up('Control');
check('Ctrl+Z undoes', (await page.$('.stack[data-spot="straight:0"]')) === null);

// ------------------------------------------------------------ 10. rules modal
await page.click('[aria-label="Rules and payouts"]');
await page.waitForSelector('.rules');
const rules = await page.$eval('.rules', (el) => {
  const f = el.querySelector('.sheet__footer');
  const b = f.lastElementChild;
  return { rows: el.querySelectorAll('.paytable tbody tr').length, right: Math.round(f.getBoundingClientRect().right - b.getBoundingClientRect().right), focused: document.activeElement === b };
});
check('rules modal: full paytable, primary right-aligned and focused', rules.rows === 12 && rules.right <= 32 && rules.focused, JSON.stringify(rules));
await sleep(500);
await page.screenshot({ path: `${OUT}/rules.png` });
await page.keyboard.press('Escape');
await sleep(100);
check('Esc closes only the modal (inspector drawer stays open)', (await page.$('.rules')) === null && (await page.$('.inspector')) !== null);

// ------------------------------------------------------------ 11. typography rules
const typo = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('.app *')) {
    const lh = getComputedStyle(el).lineHeight;
    if (lh === 'normal') continue;
    const v = parseFloat(lh);
    if (!Number.isInteger(v) || v % 2 !== 0) bad.push(`${el.className || el.tagName}:${lh}`);
  }
  const tab = ['[data-testid="balance"]', '[data-testid="stake"]', '.history__item', '.chip__face', '.cell__num', '.preview'].filter(
    (s) => document.querySelector(s) && !getComputedStyle(document.querySelector(s)).fontVariantNumeric.includes('tabular-nums'),
  );
  return { bad: [...new Set(bad)].slice(0, 5), tab };
});
check('every explicit line height is an even integer', typo.bad.length === 0, typo.bad.join(' '));
check('balances, bets, chips, history and table numbers use tabular-nums', typo.tab.length === 0, typo.tab.join(' '));

// ------------------------------------------------------------ 12. FPS (GPU only)
if (GPU) {
  await click('[data-testid="chip-500"]');
  await spot('odd');
  await click('[data-testid="spin"]');
  await sleep(1400);
  const fps = await page.$eval('[data-testid="fps"]', (e) => Number(e.dataset.fps));
  check('renderer holds ≥ 50 fps mid-spin (GPU)', fps >= 50, `${fps} fps`);
  await waitState(['RESULT'], 8000);
} else {
  console.log('SKIP  FPS assertion (E2E_GPU=0)');
}
check('no console errors during play', errors.length === 0, errors.slice(0, 3).join(' | '));

// ------------------------------------------------------------ 13. responsive layouts
const VIEWS = [
  ['phone-portrait', 390, 844, true],
  ['phone-small', 360, 740, true],
  ['phone-landscape', 844, 390, true],
  ['tablet', 820, 1180, true],
  ['laptop', 1280, 720, false],
];
for (const [name, w, h, touch] of VIEWS) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2 });
  await p.goto(`${BASE}?seed=layout&force=8&landing=900&hold=60000&latency=40-40`, { waitUntil: 'networkidle0' });
  await sleep(400);
  for (const id of ['straight:8', 'dozen:1', 'black']) await p.tap(`.felt [data-spot="${id}"]`);
  await p.tap('[data-testid="spin"]');
  await sleep(1600);
  const m = await p.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const spin = r('[data-testid="spin"]');
    const felt = r('.felt');
    const wheel = r('.wheel__canvas');
    const chips = [...document.querySelectorAll('.chip')].map((c) => c.getBoundingClientRect());
    const inView = (b) => b && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
    return {
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      spin: inView(spin),
      spinSize: spin ? Math.round(Math.min(spin.width, spin.height)) : 0,
      felt: felt && felt.left >= -1 && felt.right <= innerWidth + 1,
      wheel: inView(wheel),
      chips: chips.every(inView) && chips.every((c) => c.width >= 32),
      portrait: !!document.querySelector('.felt--portrait'),
      result: document.querySelector('[data-testid="result"]')?.dataset.number,
    };
  });
  const wantPortrait = w < h && w <= 760;
  check(
    `layout ${name} ${w}×${h}: no overflow, wheel/felt/chips/spin in view, table ${wantPortrait ? 'vertical' : 'horizontal'}`,
    !m.overflowX && m.spin && m.spinSize >= 40 && m.felt && m.wheel && m.chips && m.portrait === wantPortrait && m.result === '8',
    JSON.stringify(m),
  );
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await p.close();
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
