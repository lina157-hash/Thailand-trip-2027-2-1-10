/* 第四輪功能：今天路線一鍵導航、主辦人集合點名、我的備註、餐廳與訂位一覽。
   退稅與小費小抄在 tools.js。需要 app.js、cloud.js、extras.js、more.js 先載入。 */

/* ── 今天路線：把當天有地圖地點的活動依順序串成 Google 地圖路線（開車）──
   Google 地圖的路線網址在手機上最多 3 個中途站，站數太多就拆成幾段。
   台灣的機場（城市是「桃園」）不算在泰國的路線裡。 */
function routeStops(d) {
  const out = [];
  for (const e of visibleEvents(d)) {
    const place = String(e.place || '').trim();
    if (!place || e.city === '桃園') continue;
    const q = place + (/thailand|bangkok|pattaya|ayutthaya|kanchanaburi/i.test(place) ? '' : ' Thailand');
    if (out.length && out[out.length - 1].q === q) continue;
    out.push({ q, title: e.title });
  }
  return out;
}
function routeUrls(d) {
  const stops = routeStops(d); if (stops.length < 2) return [];
  const per = 3 + 2, urls = []; // 用手機的上限（3 個中途站），電腦也一樣，避免同一天在不同裝置分段不同
  for (let i = 0; i < stops.length - 1; i += per - 1) {
    const part = stops.slice(i, i + per); if (part.length < 2) break;
    const mid = part.slice(1, -1).map(s => s.q).join('|');
    urls.push({ from: i + 1, to: i + part.length, url: 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(part[0].q) + '&destination=' + encodeURIComponent(part[part.length - 1].q) + (mid ? '&waypoints=' + encodeURIComponent(mid) : '') });
  }
  return urls;
}
function routeLinks(d, compact) {
  const urls = routeUrls(d); if (!urls.length) return '';
  const n = routeStops(d).length;
  return urls.map(u => `<a class="quiet route-link" href="${esc(u.url)}" target="_blank" rel="noopener noreferrer">${PIN}${compact ? '今天路線' : '在地圖看路線'}${urls.length > 1 ? `（第 ${u.from}–${u.to} 站）` : `（${n} 站）`}</a>`).join('');
}

/* ── 我的備註：每天一段，存在個人資料（state.mynotes），會跟著「匯出個人備份」 ── */
$('#my-note')?.addEventListener('input', e => {
  state.mynotes = state.mynotes || {};
  // 存到這個輸入框目前顯示的那一天（換天時 iPhone 不一定會先離開輸入框）
  const d = +e.target.dataset.day || day, v = e.target.value.slice(0, 2000);
  if (v.trim()) state.mynotes[d] = v; else delete state.mynotes[d];
  save();
});

/* ── 餐廳與訂位：主辦人在活動裡選「用餐訂位」，每日行程顯示標籤，下面有整趟的一覽 ── */
const DINE = { todo: ['待訂位', 'dine-todo'], booked: ['已訂位', 'dine-booked'], walkin: ['現場用餐', 'dine-walkin'] };
function dinePill(e) {
  const k = DINE[e.dine]; if (!k) return '';
  const pax = String(e.dinePax || '').trim();
  return `<span class="pill dine-pill ${k[1]}">🍽 ${k[0]}${pax ? ' · ' + esc(pax) + ' 人' : ''}</span>`;
}
function renderDine() {
  const panel = $('#dine-panel'); if (!panel) return;
  const rows = [];
  for (let d = 1; d <= 10; d++) for (const e of visibleEvents(d)) if (DINE[e.dine]) rows.push([d, e]);
  panel.hidden = !rows.length;
  if (!rows.length) return;
  const todo = rows.filter(([, e]) => e.dine === 'todo').length;
  $('#dine-count').textContent = `${rows.length} 餐${todo ? `・${todo} 個待訂位` : ''}`;
  $('#dine-list').innerHTML = `<ol class="dine-list">${rows.map(([d, e]) => `<li data-dow="${dowOf(d)}"><button type="button" class="dine-day" data-goto-dine="${d}">2/${d}<small>週${weekdays[d - 1]}</small></button><div class="dine-main"><b>${e.time ? `<time>${esc(e.time)}</time>` : ''}${esc(e.title)}</b>${dinePill(e)}${String(e.dineNote || '').trim() ? `<small>${esc(e.dineNote)}</small>` : ''}${e.place ? `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.place + ' Thailand')}" target="_blank" rel="noopener noreferrer">${PIN}${esc(e.place)}</a>` : ''}</div></li>`).join('')}</ol>`;
}
$('#dine-list')?.addEventListener('click', e => {
  const b = e.target.closest('[data-goto-dine]'); if (!b) return;
  day = +b.dataset.gotoDine; renderDay(); $('#days').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
});
/* 主辦人「待辦」頁：訂位狀態，以及看起來是用餐、但還沒標記的活動 */
const MEAL_WORDS = /早餐|午餐|晚餐|用餐|餐廳|美食|小吃|Summer House|大頭蝦/i;
function dineSummary(src) {
  const marked = src.events.filter(e => DINE[e.dine]).sort((a, b) => a.day - b.day);
  const guess = src.events.filter(e => !e.dine && MEAL_WORDS.test(e.title)).sort((a, b) => a.day - b.day);
  return '<h3>餐廳訂位</h3>'
    + (marked.length ? `<ul class="todo-miss">${marked.map(e => `<li><span class="pill">2/${e.day}</span><span>${esc(e.title || '未命名活動')}</span>${dinePill(e)}<button class="text-btn" type="button" data-todo-dine="${esc(e.id)}">改</button></li>`).join('')}</ul>` : '<p class="muted">還沒有標記用餐的活動。在活動的「用餐訂位」選狀態，旅伴就會在「餐廳與訂位一覽」看到。</p>')
    + (guess.length ? `<p class="muted">這些看起來是用餐，還沒標記：</p><ul class="todo-miss">${guess.map(e => `<li><span class="pill">2/${e.day}</span><span>${esc(e.title)}</span><button class="text-btn" type="button" data-todo-dine="${esc(e.id)}">去標記</button></li>`).join('')}</ul>` : '');
}
$('#todo-editor')?.addEventListener('click', e => {
  const b = e.target.closest('[data-todo-dine]'); if (!b || !draft) return;
  const ev = draft.events.find(x => x.id === b.dataset.todoDine); if (!ev) return;
  draftDay = ev.day; renderEditorDay(); showPane('day');
  const input = $('#activity-editor').querySelector(`[data-event="${CSS.escape(ev.id)}"][data-field="dine"]`);
  if (input) { input.scrollIntoView({ block: 'center' }); input.focus(); }
});

/* ── 旅伴名單（點名用）：在「編輯共同行程 → 首頁與總覽」最下面，一行一位，可以寫「小明／國泰組」 ── */
const rosterOf = (src = window.TRIP_DATA) => (Array.isArray(src.roster) ? src.roster : []).filter(p => p && typeof p.name === 'string' && p.name.trim());
function editorExtras4() {
  const box = $('#intro-editor'); if (!box || !draft) return;
  const lines = rosterOf(draft).map(p => p.group ? p.name + '／' + p.group : p.name).join('\n');
  const people = draft.split && Array.isArray(draft.split.people) ? draft.split.people.filter(Boolean) : [];
  box.insertAdjacentHTML('beforeend', `<h3>旅伴名單（點名用）</h3>` + inputField('一行一位', lines, 'data-roster maxlength="2000" rows="6" placeholder="例如：&#10;小明／長榮組&#10;小華／國泰組"', true, '主辦人按右上角「點名」時會列出這些名字。有分組的話在名字後面加「／組別」，點名時可以只看某一組')
    + (!lines && people.length ? `<button type="button" class="quiet" data-roster-from-split>從團體分帳的名單帶入（${people.length} 位）</button>` : ''));
}
function parseRoster(text) {
  const gs = Array.isArray(draft.groups) ? draft.groups : [], seen = new Set(), out = [];
  for (const line of String(text).split('\n')) {
    const [name, group] = line.split(/[／/]/).map(x => (x || '').trim());
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(group && gs.includes(group) ? { name: name.slice(0, 30), group } : { name: name.slice(0, 30) });
  }
  return out.slice(0, 60);
}
$('#intro-editor')?.addEventListener('input', e => {
  if (!draft || saving || !('roster' in e.target.dataset)) return;
  const r = parseRoster(e.target.value);
  if (r.length) draft.roster = r; else delete draft.roster;
});
$('#intro-editor')?.addEventListener('click', e => {
  if (!draft || saving || !e.target.closest('[data-roster-from-split]')) return;
  const t = $('#intro-editor [data-roster]'); t.value = draft.split.people.filter(Boolean).join('\n');
  t.dispatchEvent(new Event('input', { bubbles: true })); e.target.closest('button').remove(); t.focus();
});

/* ── 集合點名（主辦人登入後右上角出現「點名」）：點名字打勾，記錄只存在這台裝置，換一天自動清空 ── */
const ROLL_KEY = 'thai-days-roll-v1';
let rollGroup = '';
function readRoll() { try { const r = JSON.parse(localStorage.getItem(ROLL_KEY)); if (r && r.date === bkkDate() && Array.isArray(r.here)) return r; } catch {} return { date: bkkDate(), here: [] }; }
function writeRoll(r) { try { localStorage.setItem(ROLL_KEY, JSON.stringify(r)); } catch {} }
function renderRoll() {
  const all = rosterOf(), gs = tripGroups(), roll = readRoll();
  const list = all.filter(p => !rollGroup || p.group === rollGroup);
  const here = list.filter(p => roll.here.includes(p.name)), missing = list.filter(p => !roll.here.includes(p.name));
  const t = bkkDate(), d = t >= '2027-02-01' && t <= '2027-02-10' ? +t.slice(8) : 0;
  $('#roll-sub').textContent = (d ? `2/${d}（週${weekdays[d - 1]}）` : '今天') + '・記錄只存在這台裝置，換一天會自動清空';
  if (!all.length) { $('#roll-body').innerHTML = '<p class="ed-help">還沒有旅伴名單。請到「編輯共同行程 → 首頁與總覽」最下面填「旅伴名單」，一行一位。</p>'; return; }
  const usedGroups = gs.filter(g => all.some(p => p.group === g));
  $('#roll-body').innerHTML = (usedGroups.length ? `<div class="chips roll-groups">${['', ...usedGroups].map(g => `<button type="button" class="chip${g === rollGroup ? ' active' : ''}" data-roll-group="${esc(g)}" aria-pressed="${g === rollGroup}">${g ? esc(g) : '全部'}</button>`).join('')}</div>` : '')
    + `<p class="roll-count${missing.length ? '' : ' all'}">${missing.length ? `已到 <b>${here.length}</b> / ${list.length}` : `全員到齊 ${list.length} 人 🎉`}</p>`
    + (missing.length && here.length ? `<p class="roll-missing">還沒到：${esc(missing.map(p => p.name).join('、'))}</p>` : '')
    + `<div class="roll-grid">${list.map(p => `<button type="button" class="roll-name${roll.here.includes(p.name) ? ' here' : ''}" data-roll="${esc(p.name)}" aria-pressed="${roll.here.includes(p.name)}"><span>${esc(p.name)}</span>${p.group && !rollGroup ? `<small>${esc(p.group)}</small>` : ''}</button>`).join('')}</div>`
    + `<div class="roll-actions"><button type="button" class="quiet" data-roll-reset>全部清除，重新點名</button></div>`;
}
const rollDlg = $('#roll-dialog');
if (rollDlg) {
  $('#rollcall-btn')?.addEventListener('click', () => { renderRoll(); rollDlg.showModal(); });
  rollDlg.addEventListener('click', e => {
    if (e.target === rollDlg || e.target.closest('[data-roll-close]')) return rollDlg.close();
    const g = e.target.closest('[data-roll-group]'); if (g) { rollGroup = g.dataset.rollGroup; return renderRoll(); }
    const n = e.target.closest('[data-roll]'), roll = readRoll();
    if (n) {
      const name = n.dataset.roll, before = rosterOf().filter(p => !rollGroup || p.group === rollGroup).every(p => roll.here.includes(p.name));
      roll.here = roll.here.includes(name) ? roll.here.filter(x => x !== name) : [...roll.here, name];
      writeRoll(roll); renderRoll();
      const after = rosterOf().filter(p => !rollGroup || p.group === rollGroup).every(p => roll.here.includes(p.name));
      if (after && !before) toast('全員到齊，可以出發了！');
    }
    if (e.target.closest('[data-roll-reset]') && confirm('清除這次的點名紀錄？')) { writeRoll({ date: bkkDate(), here: [] }); renderRoll(); }
  });
}

/* ── 每次重畫當天行程時：路線按鈕、餐廳一覽 ── */
function renderDayExtras() {
  const r = $('#day-route');
  if (r) { const links = routeLinks(day); r.hidden = !links; r.innerHTML = links; }
  renderDine();
}
renderDay();
