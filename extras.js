/* 第二輪功能：行程更新通知、加入手機行事曆、天氣、主辦人的待辦與待補資料。
   需要 app.js、cloud.js 先載入（使用 $、esc、toast、visibleEvents、renderDay、draft 等）。 */

/* ── 行程更新通知 ──
   每台裝置記住「上次看過的共同行程」每一天的內容摘要；主辦人儲存新版本後，
   旅伴打開網站會在最上面看到哪幾天有改，按「知道了」就不再顯示。只存在各自的裝置。 */
const SEEN_KEY = 'thai-days-seen-v1';
function tripDigest(data) {
  const h = s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  const days = {};
  for (let d = 1; d <= 10; d++) {
    const parts = [data.titles?.[d], data.hotels?.[d], data.transport?.[d], data.notes?.[d], data.meet?.[d],
      JSON.stringify((data.events || []).filter(e => e.day === d).map(e => [e.time, e.title, e.city, e.place, e.note, e.group || '', ...(e.optional ? [1, e.joined || ''] : []), ...(e.dine ? ['dine', e.dine, e.dinePax || '', e.dineNote || ''] : [])]))];
    if (data.bring && data.bring[d] !== undefined) parts.push('bring:' + data.bring[d]); // 「記得帶」改過才算進去，舊的摘要不受影響
    days[d] = h(parts.map(p => p || '').join('\u0001'));
  }
  return { days, intro: h(JSON.stringify(data.intro || {})), checklist: h(JSON.stringify(data.checklist || [])) };
}
function readSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || null; } catch { return null; } }
function writeSeen(result) { try { localStorage.setItem(SEEN_KEY, JSON.stringify({ updatedAt: result.updatedAt, digest: tripDigest(result.data) })); } catch {} }
function markTripSeen(result) { writeSeen(result); const b = $('#update-banner'); if (b) b.hidden = true; }
function noticeUpdates(result) {
  const box = $('#update-banner'); if (!box) return;
  const seen = readSeen();
  if (!seen || !seen.digest) { writeSeen(result); return; } // 第一次打開：直接記下，不顯示
  if (seen.updatedAt === result.updatedAt) return;
  const now = tripDigest(result.data), changed = [];
  for (let d = 1; d <= 10; d++) if (seen.digest.days?.[d] !== now.days[d]) changed.push(d);
  const other = [seen.digest.intro !== now.intro ? '首頁的航班、住宿、交通或訂房訂票' : '', seen.digest.checklist !== now.checklist ? '出發清單' : ''].filter(Boolean);
  if (!changed.length && !other.length) { writeSeen(result); return; }
  const when = result.updatedAt ? new Date(result.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  box.innerHTML = `<div><b>主辦人${when ? '在 ' + esc(when) + ' ' : ''}更新了行程</b><p>${changed.length ? '有改動的日子：' + changed.map(d => `<button type="button" class="text-btn" data-goto-day="${d}">2/${d}</button>`).join('、') : ''}${changed.length && other.length ? '；' : ''}${other.length ? '另外改了' + other.join('、') : ''}</p></div><button type="button" class="quiet" data-seen>知道了</button>`;
  box._result = result;
  box.hidden = false;
}
$('#update-banner')?.addEventListener('click', e => {
  const box = e.currentTarget, g = e.target.closest('[data-goto-day]');
  if (g) { day = +g.dataset.gotoDay; showTab('plan'); renderDay(); $('#plan').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' }); }
  if (e.target.closest('[data-seen]') && box._result) markTripSeen(box._result);
});

/* ── 加入手機行事曆（.ics）──
   每天一個整天的行程摘要，有時間的活動另外各一筆（預設 1 小時）。
   桃園的時間是台灣時間（UTC+8），其餘是泰國時間（UTC+7）。依「我的組別」篩選。 */
function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) {
  const enc = new TextEncoder(); let out = '', cur = '', bytes = 0;
  for (const ch of line) { const n = enc.encode(ch).length; if (bytes + n > 73) { out += cur + '\r\n '; cur = ''; bytes = 1; } cur += ch; bytes += n; }
  return out + cur;
}
function buildIcs() {
  const D = window.TRIP_DATA, stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', lines = [];
  const utc = (d, t, off) => { const [h, m] = t.split(':').map(Number); return new Date(Date.UTC(2027, 1, d, h - off, m)).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; };
  lines.push('BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//thai-days//2027//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:泰好時光 2027');
  for (let d = 1; d <= 10; d++) {
    const ev = visibleEvents(d), meet = meetOf(d);
    const bring = typeof bringOf === 'function' ? bringOf(d) : '';
    const desc = [meet ? '集合：' + meet : '', bring ? '記得帶：' + bring : '', ...ev.map(e => (e.time ? e.time + ' ' : '') + e.title), D.hotels?.[d] && d < 10 ? '住宿：' + D.hotels[d] : ''].filter(Boolean).join('\n');
    const ymd = '202702' + String(d).padStart(2, '0'), next = d < 10 ? '202702' + String(d + 1).padStart(2, '0') : '20270211';
    lines.push('BEGIN:VEVENT', 'UID:thai-days-day' + d + '@thai-days', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd, 'DTEND;VALUE=DATE:' + next,
      'SUMMARY:' + icsText(`泰國第 ${d} 天：${D.titles?.[d] || ''}`), 'DESCRIPTION:' + icsText(desc), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    for (const e of ev) {
      if (!/^\d{1,2}:\d{2}$/.test(e.time || '')) continue;
      const off = e.city === '桃園' ? 8 : 7, start = utc(d, e.time, off);
      const end = new Date(Date.parse(start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) + 3600000).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      lines.push('BEGIN:VEVENT', 'UID:thai-days-' + String(e.id).replace(/[^\w-]/g, '') + '@thai-days', 'DTSTAMP:' + stamp, 'DTSTART:' + start, 'DTEND:' + end,
        'SUMMARY:' + icsText(e.title), ...(e.place ? ['LOCATION:' + icsText(e.place)] : []), 'DESCRIPTION:' + icsText(e.note), 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
$('#ics-export')?.addEventListener('click', () => {
  const blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = '泰好時光-2027行程.ics'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('已下載行程檔，打開它就能加入行事曆。行程改了要再加一次。');
});

/* ── 天氣 ──
   出發前 16 天內向 Open-Meteo（免費、不需帳號）取得芭達雅與曼谷的預報，每 3 小時更新一次；
   更早之前顯示 2 月的平均氣候。只送出城市座標，不送任何個人資料。 */
const WX_KEY = 'thai-days-weather-v1';
const WX_CITY = { pattaya: { name: '芭達雅', lat: 12.93, lon: 100.88, avg: '2 月平均 白天約 32°C、晚上約 25°C，很少下雨' }, bangkok: { name: '曼谷', lat: 13.75, lon: 100.5, avg: '2 月平均 白天約 33°C、晚上約 24°C，很少下雨' } };
const WX_CODE = c => c === 0 ? ['☀️', '晴'] : c <= 2 ? ['🌤️', '晴時多雲'] : c === 3 ? ['☁️', '陰'] : c <= 48 ? ['🌫️', '霧'] : c <= 67 ? ['🌧️', '雨'] : c <= 77 ? ['🌨️', '雪'] : c <= 82 ? ['🌦️', '陣雨'] : ['⛈️', '雷雨'];
let wxData = null;
try { const c = JSON.parse(localStorage.getItem(WX_KEY)); if (c && c.data) wxData = c; } catch {}
const cityOfDay = d => /mercure|pattaya|芭達雅/i.test(String(window.TRIP_DATA.hotels?.[d] || '')) || d <= 3 ? 'pattaya' : 'bangkok';
function weatherFor(d) {
  const key = cityOfDay(d), day = wxData?.data?.[key]?.['2027-02-' + String(d).padStart(2, '0')];
  if (!day) return '';
  const [icon, label] = WX_CODE(day.code);
  return `${icon} ${WX_CITY[key].name} ${label} ${Math.round(day.max)}° / ${Math.round(day.min)}°${day.rain != null ? `・降雨 ${day.rain}%` : ''}`;
}
async function refreshWeather() {
  const today = bkkDate(), fresh = wxData && Date.now() - wxData.at < 3 * 3600000;
  if (fresh || today < '2027-01-17' || today > '2027-02-10') return renderWeatherBox();
  try {
    const data = {};
    for (const [key, c] of Object.entries(WX_CITY)) {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=16`);
      if (!r.ok) throw Error();
      const j = await r.json(), out = {};
      j.daily.time.forEach((t, i) => { out[t] = { code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max?.[i] }; });
      data[key] = out;
    }
    wxData = { at: Date.now(), data };
    try { localStorage.setItem(WX_KEY, JSON.stringify(wxData)); } catch {}
    renderDay();
  } catch {}
  renderWeatherBox();
}
function renderWeatherBox() {
  const box = $('#weather-box'); if (!box) return;
  const rows = Array.from({ length: 10 }, (_, i) => [i + 1, weatherFor(i + 1)]).filter(([, w]) => w);
  box.innerHTML = `<details class="note-section tool-section" data-section="weather"${rows.length ? ' open' : ''}><summary><span class="note-num">☀</span><span class="note-title">天氣</span></summary><div class="tool-body">${rows.length
    ? `<ul class="sos-list">${rows.map(([d, w]) => `<li><span>2/${d}</span><span>${esc(w)}</span></li>`).join('')}</ul><p class="muted">預報來自 <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>，每 3 小時更新。</p>`
    : `<p>出發前兩週左右（1/17 起）這裡會自動顯示每天的天氣預報，每日行程上也會標出來。</p><ul class="sos-list">${Object.values(WX_CITY).map(c => `<li><span>${c.name}</span><span>${c.avg}</span></li>`).join('')}</ul>`}</div></details>`;
}
renderWeatherBox();
refreshWeather();
if (wxData) renderDay();

/* ── 主辦人：待辦清單與待補資料（在「編輯共同行程 → 待辦」）──
   待辦存在共同行程的 data.todos（[{ id, text, done }]），旅伴的頁面不會顯示。 */
const TODO_WORDS = /待確認|待安排|待補|待定|待確定|再確認|請確認/;
function todoCandidates(src) {
  const found = [], add = (d, text) => { for (const part of String(text || '').split(/[。\n；]/)) { const t = part.trim(); if (t && TODO_WORDS.test(t)) found.push(`2/${d}：${t.replace(/[，、]$/, '')}`); } };
  for (let d = 1; d <= 10; d++) { add(d, src.notes?.[d]); add(d, src.transport?.[d]); for (const e of src.events.filter(e => e.day === d)) add(d, e.note); }
  return [...new Set(found)];
}
function editorExtras() { renderTodoEditor(); if (typeof editorExtras4 === 'function') editorExtras4(); }
function renderTodoEditor() {
  const box = $('#todo-editor'); if (!box || !draft) return;
  const todos = Array.isArray(draft.todos) ? draft.todos : [], open = todos.filter(t => !t.done).length;
  const miss = draft.events.filter(e => !e.time || !e.place).sort((a, b) => a.day - b.day);
  const fresh = todoCandidates(draft).filter(t => !todos.some(x => x.text === t));
  const w = typeof expiryWarning === 'function' ? expiryWarning() : '';
  box.innerHTML = (w ? `<p class="ed-help ed-warn">${esc(w)}</p>` : '')
    + `<p class="ed-help">只有主辦人看得到這一頁。待辦清單會跟著共同行程一起儲存；下面的「待補資料」是網站自動找出來的。</p>`
    + `<div class="ed-sub"><h3>待辦清單（還有 ${open} 項）</h3><button class="quiet" type="button" data-todo-add>＋ 新增待辦</button></div>`
    + (fresh.length ? `<div class="todo-suggest"><p>行程裡還有 <b>${fresh.length}</b> 處寫著「待確認」之類的字：</p><ul>${fresh.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join('')}${fresh.length > 8 ? `<li>…還有 ${fresh.length - 8} 處</li>` : ''}</ul><button class="primary" type="button" data-todo-import>全部加入待辦</button></div>` : '')
    + (todos.length ? `<ul class="todo-list">${todos.map(t => `<li class="${t.done ? 'done' : ''}"><input type="checkbox" data-todo-done="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="完成"><input type="text" value="${esc(t.text)}" data-todo-text="${esc(t.id)}" maxlength="300" placeholder="要確認的事"><button class="text-btn danger" type="button" data-todo-del="${esc(t.id)}">刪除</button></li>`).join('')}</ul>` : '<p class="muted ed-empty">還沒有待辦。</p>')
    + (typeof joinSummary === 'function' ? joinSummary(draft) : '')
    + (typeof dineSummary === 'function' ? dineSummary(draft) : '')
    + `<h3>待補資料（${miss.length} 個活動）</h3>`
    + (miss.length ? `<p class="muted">沒有時間，「今天」卡片就算不出下一站；沒有地圖地點，旅伴就點不開地圖。</p><ul class="todo-miss">${miss.map(e => `<li><span class="pill">2/${e.day}</span><span>${esc(e.title || '未命名活動')}</span><em>${[!e.time ? '缺時間' : '', !e.place ? '缺地圖地點' : ''].filter(Boolean).join('・')}</em><button class="text-btn" type="button" data-todo-fix="${esc(e.id)}">去填</button></li>`).join('')}</ul>` : '<p class="muted">每個活動都有時間和地圖地點了。</p>');
}
const todoBox = $('#todo-editor');
if (todoBox) {
  const list = () => (Array.isArray(draft.todos) ? draft.todos : (draft.todos = []));
  todoBox.addEventListener('click', e => {
    if (!draft || saving) return;
    if (e.target.closest('[data-todo-add]')) { list().push({ id: uid(), text: '', done: false }); renderTodoEditor(); const l = [...todoBox.querySelectorAll('[data-todo-text]')].pop(); if (l) l.focus(); }
    if (e.target.closest('[data-todo-import]')) { for (const t of todoCandidates(draft)) if (!list().some(x => x.text === t)) list().push({ id: uid(), text: t, done: false }); renderTodoEditor(); }
    const del = e.target.closest('[data-todo-del]');
    if (del) { draft.todos = list().filter(t => t.id !== del.dataset.todoDel); if (!draft.todos.length) delete draft.todos; renderTodoEditor(); }
    const fix = e.target.closest('[data-todo-fix]');
    if (fix) {
      const ev = draft.events.find(x => x.id === fix.dataset.todoFix); if (!ev) return;
      draftDay = ev.day; renderEditorDay(); showPane('day');
      const input = $('#activity-editor').querySelector(`[data-event="${CSS.escape(ev.id)}"][data-field="${ev.time ? 'place' : 'time'}"]`);
      if (input) { input.scrollIntoView({ block: 'center' }); input.focus(); }
    }
  });
  todoBox.addEventListener('input', e => {
    if (!draft || saving) return;
    const t = e.target, id = t.dataset.todoText || t.dataset.todoDone; if (!id) return;
    const item = list().find(x => x.id === id); if (!item) return;
    if (t.dataset.todoText) item.text = t.value; else { item.done = t.checked; t.closest('li').classList.toggle('done', t.checked); }
  });
  /* 回到待辦頁時重新整理「待補資料」 */
  document.querySelector('#cloud-editor .ed-nav')?.addEventListener('click', e => { if (e.target.closest('[data-pane="todo"]')) renderTodoEditor(); });
}
