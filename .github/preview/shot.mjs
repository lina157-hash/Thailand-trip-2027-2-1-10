import { chromium } from 'playwright';
const E = s => (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/${z}/${y}/${x}`;
const STYLES = {
  gray: [E('Canvas/World_Light_Gray_Base'), E('Canvas/World_Light_Gray_Reference')],
  topo: [E('World_Topo_Map')],
  street: [E('World_Street_Map')],
};
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, url] of Object.entries(STYLES)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.route('**/tile.openstreetmap.org/**', async r => {
    const [z, x, y] = new URL(r.request().url()).pathname.replace('.png', '').split('/').filter(Boolean);
    const res = await r.fetch({ url: url[0](z, x, y) });
    await r.fulfill({ response: res });
  });
  // 第二層（只有文字標籤）：在地圖開好後加上去
  p.on('load', () => {});
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('#guide-dialog')?.close());
  await p.click('.tabs [data-tab="plan"]'); await p.click('#map-open'); await p.waitForTimeout(1500);
  if (url[1]) await p.evaluate(u => L.tileLayer(u, { maxZoom: 16 }).addTo(tripMap), url[1](0,0,0).replace('/tile/0/0/0', '/tile/{z}/{y}/{x}'));
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `.preview/${name}-all.png` });
  await p.click('#map-days [data-map-day="6"]'); await p.waitForTimeout(6000);
  await p.screenshot({ path: `.preview/${name}-day6.png` });
  await p.close();
}
await b.close();
