import { chromium } from 'playwright';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await c.addInitScript(() => { localStorage.setItem('thai-days-guide-v1', '1'); localStorage.setItem('thai-days-place-size-v1', 'big'); });
const p = await c.newPage(); const logs = [];
p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
await p.goto('http://localhost:8765/'); await p.waitForTimeout(3000);
const tab = async t => { await p.evaluate(t => document.querySelector(`[data-tab="${t}"]`).click(), t); await p.waitForTimeout(500); };
const settle = async () => { await p.evaluate(async () => { for (let y = 0; y < 2600; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); } scrollTo(0, 0); }); await p.waitForTimeout(3000); };
const shot = async (name, sel) => { const top = await p.$eval(sel, e => e.getBoundingClientRect().top + scrollY - 70); await p.evaluate(y => scrollTo(0, y), top); await p.waitForTimeout(1500); await p.screenshot({ path: `.preview/shots/${name}.png`, clip: { x: 0, y: top, width: 390, height: 2200 }, fullPage: true }); };
await tab('discover'); await p.click('#discover [data-kind="eat"]'); await settle(); await shot('1-eat', '#discover .places');
await tab('food'); await p.click('#food [data-kind="street"]'); await settle(); await shot('2-food-street', '#food .places');
await p.click('#sync-btn'); await p.waitForTimeout(4000); await p.screenshot({ path: '.preview/shots/3-sync.png' });
await p.keyboard.press('Escape'); await tab('gifts-tab'); await p.waitForTimeout(500); await p.screenshot({ path: '.preview/shots/4-gifts.png' });
require_fs: { const fs = await import('fs'); fs.writeFileSync('.preview/shots/console.txt', logs.join('\n')); }
await b.close();
