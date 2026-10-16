import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const [w, h, tag] of [[390, 844, 'phone'], [1280, 860, 'desk']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('#guide-dialog')?.close());
  await p.click('.tabs [data-tab="plan"]'); await p.click('#map-open'); await p.waitForTimeout(6000);
  await p.screenshot({ path: `.preview/map-all-${tag}.png` });
  await p.click('#map-days [data-map-day="6"]'); await p.waitForTimeout(5000);
  await p.click('.map-pin'); await p.waitForTimeout(800);
  await p.screenshot({ path: `.preview/map-day6-${tag}.png` });
  await p.close();
}
await b.close();
