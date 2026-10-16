import { chromium } from 'playwright';
const STYLES = {
  osm: null,
  voyager: (z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
  positron: (z, x, y) => `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
  esri: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
};
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, url] of Object.entries(STYLES)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  if (url) await p.route('**/tile.openstreetmap.org/**', async r => {
    const [z, x, y] = new URL(r.request().url()).pathname.replace('.png', '').split('/').filter(Boolean);
    const res = await r.fetch({ url: url(z, x, y), headers: { referer: 'https://lina157-hash.github.io/' } });
    await r.fulfill({ response: res });
  });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('#guide-dialog')?.close());
  await p.click('.tabs [data-tab="plan"]'); await p.click('#map-open'); await p.waitForTimeout(6000);
  await p.screenshot({ path: `.preview/${name}-all.png` });
  await p.click('#map-days [data-map-day="6"]'); await p.waitForTimeout(6000);
  await p.screenshot({ path: `.preview/${name}-day6.png` });
  await p.close();
}
await b.close();
