// Browser check of the theme system against the built app. /api/appearance is served by a stub that returns
// the admin's site default (dark + navy). Everything else under /api returns 404.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const STATIC = process.argv[2];
const APP = { font: 'default', size: 'normal', weight: 'normal', teacherCanEdit: false, theme: 'dark', accent: 'navy' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/appearance') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(APP)); }
  if (u.pathname.startsWith('/api/')) { res.writeHead(404); return res.end('{}'); }
  let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const f = path.join(STATIC, p);
  if (!f.startsWith(STATIC) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  — ' + x : '')); };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/#/`;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const state = () => page.evaluate(() => ({ dark: document.documentElement.classList.contains('dark'), accent: document.documentElement.dataset.accent || '' }));

  await page.goto(base); await page.waitForTimeout(1200);
  let s = await state();
  check('fresh visitor gets the admin default theme (dark)', s.dark === true, JSON.stringify(s));
  check('fresh visitor gets the admin default accent (navy)', s.accent === 'navy', JSON.stringify(s));

  await page.evaluate(() => localStorage.setItem('ms_theme_v2', 'light'));
  await page.reload(); await page.waitForTimeout(1200);
  s = await state();
  check('personal light choice overrides the admin dark default', s.dark === false, JSON.stringify(s));
  check('accent still follows the admin default when no personal accent', s.accent === 'navy', JSON.stringify(s));

  await page.evaluate(() => localStorage.setItem('ms_accent', 'teal'));
  await page.reload(); await page.waitForTimeout(1200);
  s = await state();
  check('personal accent (teal) overrides the admin default and survives reload', s.accent === 'teal' && s.dark === false, JSON.stringify(s));

  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  const fading = await page.evaluate(() => document.documentElement.classList.contains('theme-fade'));
  await page.waitForTimeout(150);
  s = await state();
  check('toggle switches to dark', s.dark === true, JSON.stringify(s));
  check('theme change fades colours (theme-fade class during the switch)', fading || await page.evaluate(() => document.documentElement.classList.contains('theme-fade')));
  check('dark choice is saved for next visit', (await page.evaluate(() => localStorage.getItem('ms_theme_v2'))) === 'dark');
  await page.reload(); await page.waitForTimeout(1000);
  check('dark choice persists after reload', (await state()).dark === true);

  check('no uncaught page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
