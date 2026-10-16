import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const scheme of ['light', 'dark']) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('#guide-dialog')?.close());
  await p.click('.tabs [data-tab="plan"]'); await p.click('#map-open'); await p.waitForTimeout(6000);
  await p.screenshot({ path: `.preview/${scheme}-all.png` });
  await p.click('#map-days [data-map-day="6"]'); await p.waitForTimeout(6000);
  await p.click('.map-pin'); await p.waitForTimeout(800);
  await p.screenshot({ path: `.preview/${scheme}-day6.png` });
  console.log(scheme, 'errors', errs);
  await p.close();
}
await b.close();
