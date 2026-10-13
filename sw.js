/* 離線備援：每次都先向網路要最新的檔案，成功就順手存一份；沒有網路時才拿存著的版本。
   只處理本站的檔案與 Google 字型；GitHub API、匯率資料等其他網站的請求完全不經過這裡。 */
const CACHE = 'thai-days-v4';

self.addEventListener('install', () => self.skipWaiting());
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
  const key = url.origin + url.pathname;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  }).catch(() => caches.match(key).then(hit => hit || Response.error())));
});
