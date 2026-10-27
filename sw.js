/* 離線備援：每次都先向網路要最新的檔案，成功就順手存一份；沒有網路時才拿存著的版本。
   只處理本站的檔案與 Google 字型；GitHub API、匯率資料等其他網站的請求完全不經過這裡。 */
const CACHE = 'thai-days-v27';

/* 安裝時先把整個網站存好，第一次沒打開過的分頁離線也能看 */
const ASSETS = ['./', 'index.html', 'style.css', 'gsync.js', 'trip-data.js', 'fx.js', 'inspire.js', 'app.js', 'cloud.js', 'notes.js', 'tools.js', 'split.js', 'extras.js', 'more.js', 'more2.js', 'collect.js', 'more3.js', 'map.js', 'receipts.js', 'lib/qrcode.js', 'lib/leaflet/leaflet.js', 'lib/leaflet/leaflet.css', 'geo.json', 'trip.json', 'bot-rate.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => {
    const u = new URL(a, self.registration.scope);
    return fetch(u, { cache: 'no-store' }).then(res => { if (res.ok) return c.put(u.origin + u.pathname, res); }).catch(() => {});
  }))).then(() => self.skipWaiting())
));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;

  if (font) { // 字型檔不會變，先用存著的
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // 本站檔案：網址後面的 ?v=、?t= 只是避開快取用，存的時候去掉，避免同一個檔案存很多份
  // 訊號差時最多等 3 秒，還沒回應就先用存著的版本；網路之後回來了還是會更新存檔
  const key = url.origin + url.pathname;
  const net = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); return caches.open(CACHE).then(c => c.put(key, copy)).then(() => res, () => res); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => caches.match(key).then(finish), 3000);
    net.then(res => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); caches.match(key).then(hit => finish(hit || Response.error())); });
  }));
});
