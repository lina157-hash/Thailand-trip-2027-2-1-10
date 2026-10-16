/* 全行程地圖：把共同行程裡每個活動的地點釘在同一張地圖上（OpenStreetMap＋內附的 Leaflet 1.9.4）。
   座標由 GitHub Actions 事先查好放在 geo.json（見 .github/scripts/geocode.py）；查不到座標的地點列在地圖下面，可以用 Google 地圖開。
   選某一天時，會依時間順序標上 1、2、3… 並用線連起來。台灣、香港的機場不畫在地圖上，避免地圖縮得太小。 */
const mapDlg = $('#map-dialog');
let tripMap = null, mapLayer = null, mapDay = 0, geoData = null;
const inThailand = g => g && g.lat > 5.6 && g.lat < 20.5 && g.lon > 97.3 && g.lon < 105.7;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, fail) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/leaflet/leaflet.css'; document.head.append(css);
    const s = document.createElement('script'); s.src = 'lib/leaflet/leaflet.js'; s.onload = ok; s.onerror = fail; document.head.append(s);
  });
}
async function loadGeo() {
  try { const r = await fetch('geo.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) geoData = await r.json(); } catch {}
  return geoData || {};
}
function mapStops() {
  const geo = geoData || {}, out = [], missing = new Map();
  for (let d = 1; d <= 10; d++) {
    if (mapDay && d !== mapDay) continue;
    visibleEvents(d).filter(e => e.place).forEach(e => {
      const g = geo[e.place.trim()];
      if (inThailand(g)) out.push({ d, e, lat: g.lat, lon: g.lon });
      else if (!g || g.lat == null) missing.set(e.place, d);
    });
  }
  return { out, missing };
}
function renderMap() {
  const { out, missing } = mapStops();
  $('#map-days').innerHTML = [0, ...Array.from({ length: 10 }, (_, i) => i + 1)].map(d => `<button type="button" class="chip${d === mapDay ? ' active' : ''}" data-map-day="${d}" aria-pressed="${d === mapDay}"${d ? ` data-dow="${dowOf(d)}"` : ''}>${d ? `2/${d}` : '全部'}</button>`).join('');
  mapLayer.clearLayers();
  // 同一個地點同一天出現多次就合併成一個圖釘
  const pins = new Map();
  out.forEach((s, i) => { const k = `${s.d}|${s.lat},${s.lon}`; if (!pins.has(k)) pins.set(k, { ...s, items: [], n: 0 }); pins.get(k).items.push(s.e); });
  let n = 0; for (const p of pins.values()) p.n = ++n;
  for (const p of pins.values()) {
    const label = mapDay ? p.n : p.d;
    const icon = L.divIcon({ className: '', html: `<span class="map-pin" data-dow="${dowOf(p.d)}">${label}</span>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
    const q = encodeURIComponent(p.items[0].place + ' Thailand');
    L.marker([p.lat, p.lon], { icon, title: p.items[0].place }).addTo(mapLayer).bindPopup(`<div class="map-pop"><b>2/${p.d}（週${weekdays[p.d - 1]}）</b>${p.items.map(e => `<p>${e.time ? `<time>${esc(e.time)}</time> ` : ''}${esc(e.title)}</p>`).join('')}<a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">在 Google 地圖開啟</a></div>`);
  }
  if (mapDay) {
    const line = [...pins.values()].map(p => [p.lat, p.lon]);
    if (line.length > 1) L.polyline(line, { color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#444', weight: 3, opacity: .55, dashArray: '6 6' }).addTo(mapLayer);
  }
  const pts = [...pins.values()].map(p => [p.lat, p.lon]);
  if (pts.length) tripMap.fitBounds(pts, { padding: [36, 36], maxZoom: 15 }); else tripMap.setView([13.3, 100.7], 8);
  const miss = [...missing.keys()].filter(p => !/taiwan|taoyuan|hong kong/i.test(p));
  $('#map-note').innerHTML = (pts.length ? '' : `<p>${mapDay ? `2/${mapDay} 沒有可以畫在地圖上的地點。` : '還沒有地點座標。'}</p>`)
    + (miss.length ? `<p>還沒找到座標的地點：${miss.map(p => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p + ' Thailand')}" target="_blank" rel="noopener noreferrer">${esc(p)}</a>`).join('、')}</p>` : '')
    + `<p class="muted">${mapDay ? '數字是當天的順序，點圖釘看時間和行程。' : '數字是第幾天（2/1＝1），點圖釘看那天的行程。'}選了組別的話只會顯示你那組的行程。</p>`;
}
async function openMap() {
  mapDlg.showModal();
  $('#map-note').innerHTML = '<p class="muted">地圖載入中…</p>';
  try { await Promise.all([loadLeaflet(), loadGeo()]); } catch { $('#map-note').innerHTML = '<p>地圖需要網路才能打開，請連上網路再試。</p>'; return; }
  if (!tripMap) {
    tripMap = L.map('trip-map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(tripMap);
    mapLayer = L.layerGroup().addTo(tripMap);
  }
  mapDay = mapDay || 0;
  setTimeout(() => { tripMap.invalidateSize(); renderMap(); }, 50);
}
if (mapDlg) {
  $('#map-open')?.addEventListener('click', () => { mapDay = 0; openMap(); });
  mapDlg.addEventListener('click', e => {
    if (e.target === mapDlg || e.target.closest('[data-map-close]')) return mapDlg.close();
    const b = e.target.closest('[data-map-day]'); if (b && tripMap) { mapDay = +b.dataset.mapDay; renderMap(); }
  });
}
