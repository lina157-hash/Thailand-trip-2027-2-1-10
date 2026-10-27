/* 第三輪功能：每日「記得帶」、自選活動回報、出發前提醒、匯率換算、一頁列印版、顯示設定（深色／大字體），
   以及主辦人的「歷史版本」還原。需要 app.js、cloud.js、extras.js 先載入（使用 $、esc、toast、renderDay、draft 等）。 */

/* ── 每日「記得帶」──
   主辦人沒改過的日子用下面的建議；在編輯器改過（存在 data.bring）就用主辦人的，清空就不顯示。 */
const BRING_DEFAULT = {
  1: '護照、手機與充電線、行動電源（隨身，不能托運）、泰銖現金、薄外套（飛機上冷）',
  2: '泳衣、防曬、拖鞋',
  3: '泳衣、防曬、帽子、墨鏡、防水手機袋、毛巾、拖鞋、暈船藥、現金零錢（島上多半只收現金）',
  4: '遮肩過膝的衣服（真理寺）、防曬、行李全部帶上車',
  5: '遮肩過膝、不緊身不破洞的衣服（大皇宮查得很嚴）、好走的鞋、防曬、水、晚上遊船的薄外套',
  6: '環保袋、現金零錢（市集多收現金）、好走的鞋、小扇子、水',
  7: '帽子、防曬、防蚊液、好走的鞋、水、現金',
  8: '遮肩過膝的衣服（寺廟）、帽子、防曬、現金（市場與小吃）',
  9: '把退稅單據收在一起、晚上整理好行李',
  10: '護照、退稅單據、行動電源放隨身包',
};
function bringOf(d, src = window.TRIP_DATA) {
  const v = src && src.bring && typeof src.bring === 'object' ? src.bring[d] : undefined;
  return v !== undefined && v !== null ? String(v).trim() : (BRING_DEFAULT[d] || '');
}

/* ── 自選活動：旅伴按「我要參加」→ 打開 LINE 傳訊息給主辦人；主辦人把名字填進名單後，大家都看得到人數 ──
   網站沒有後台可以直接收報名，所以用 LINE 轉達。名字與「已傳送」狀態只存在各自的裝置。 */
const NAME_KEY = 'thai-days-name-v1', JOIN_KEY = 'thai-days-joins-v1';
let myName = '', myJoins = {};
try { myName = localStorage.getItem(NAME_KEY) || ''; myJoins = JSON.parse(localStorage.getItem(JOIN_KEY)) || {}; } catch {}
const joinedNames = e => [...new Set(String(e.joined || '').split(/[、,，;；\n]/).map(x => x.trim()).filter(Boolean))];
function joinRow(e) {
  const names = joinedNames(e), mine = !!myName && names.includes(myName), sent = myJoins[e.id], id = esc(e.id);
  const btn = (mode, text, cls = 'text-btn') => `<button type="button" class="${cls}" data-join="${id}" data-join-mode="${mode}">${text}</button>`;
  let action;
  if (mine && sent !== 'out') action = `<span class="join-ok">你在名單上 ✓</span>${btn('out', '改成不參加')}`;
  else if (mine) action = `<span class="join-ok">已傳「不參加」，等主辦人更新名單</span>${btn('in', '還是要參加')}`;
  else if (sent === 'in') action = `<span class="join-ok">已傳給主辦人，等主辦人加進名單</span>${btn('out', '改成不參加')}`;
  else action = btn('in', '我要參加', 'quiet join-btn');
  return `<div class="join-row"><p>${names.length ? `已報名 <b>${names.length}</b> 人：${esc(names.join('、'))}` : '還沒有人報名'}</p><div class="join-actions">${action}${myName ? `<button type="button" class="text-btn join-name" data-join-rename>我是 ${esc(myName)}（改名字）</button>` : ''}</div></div>`;
}
function askName() {
  const n = (prompt('請輸入你的名字（主辦人用來登記；只存在這台裝置）', myName) || '').trim().slice(0, 30);
  if (!n) return false;
  myName = n; try { localStorage.setItem(NAME_KEY, n); } catch {}
  return true;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-join-rename]')) { if (askName()) renderDay(); return; }
  const b = e.target.closest('[data-join]'); if (!b) return;
  const ev = window.TRIP_DATA.events.find(x => x.id === b.dataset.join); if (!ev) return;
  if (!myName && !askName()) return;
  const mode = b.dataset.joinMode === 'out' ? 'out' : 'in';
  const msg = `【泰好時光】我是 ${myName}，2/${ev.day}「${ev.title}」${mode === 'in' ? '我要參加 ✋' : '我不參加了，麻煩幫我從名單拿掉，謝謝'}`;
  myJoins[ev.id] = mode; try { localStorage.setItem(JOIN_KEY, JSON.stringify(myJoins)); } catch {}
  try { navigator.clipboard.writeText(msg).catch(() => {}); } catch {}
  window.open('https://line.me/R/share?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  toast('已打開 LINE，選主辦人把訊息傳出去就完成了（訊息也已複製）');
  renderDay();
});
/* 主辦人在「待辦」頁看到每個自選活動的報名人數 */
function joinSummary(src) {
  const list = src.events.filter(e => e.optional).sort((a, b) => a.day - b.day);
  return '<h3>自選活動報名</h3>' + (list.length
    ? `<ul class="todo-miss">${list.map(e => { const n = joinedNames(e); return `<li><span class="pill">2/${e.day}</span><span>${esc(e.title || '未命名活動')}${n.length ? `<small class="join-names">${esc(n.join('、'))}</small>` : ''}</span><em class="join-count">${n.length} 人</em><button class="text-btn" type="button" data-todo-join="${esc(e.id)}">改名單</button></li>`; }).join('')}</ul>`
    : '<p class="muted">還沒有自選活動。在「每日行程」的活動裡勾「自選活動」，旅伴就能按「我要參加」用 LINE 回報給你。</p>');
}
$('#todo-editor')?.addEventListener('click', e => {
  const b = e.target.closest('[data-todo-join]'); if (!b || !draft) return;
  const ev = draft.events.find(x => x.id === b.dataset.todoJoin); if (!ev) return;
  draftDay = ev.day; renderEditorDay(); showPane('day');
  const input = $('#activity-editor').querySelector(`[data-event="${CSS.escape(ev.id)}"][data-field="joined"]`);
  if (input) { input.scrollIntoView({ block: 'center' }); input.focus(); }
});

/* ── 出發前提醒：照日期提醒該做的事，勾選只存在這台裝置 ──
   TDAC 要在抵達泰國前 3 天內填（長榮組 2/1 抵達、國泰組 2/5 凌晨抵達）。 */
const PREP_KEY = 'thai-days-prep-v1', PREP_HIDE_KEY = 'thai-days-prep-hide-v1';
const TDAC_LINK = ['https://tdac.immigration.go.th', '打開 TDAC 官方網站'];
const PREP = [
  { id: 'passport', from: '2026-10-01', to: '2026-12-31', title: '確認護照效期', text: '入境泰國時護照要有 6 個月以上效期，最好 2027 年 8 月中以後才到期。快到期或破損，現在就去換。' },
  { id: 'insurance', from: '2026-12-01', to: '2027-01-31', title: '買旅遊保險', text: '建議含海外醫療與班機延誤。買好後把急難救助電話填到「旅途工具 → 緊急聯絡」。' },
  { id: 'cash', from: '2027-01-11', to: '2027-01-31', title: '換泰銖、準備現金', text: '海關可能抽查：每人備等值 2 萬泰銖（每個家庭 4 萬）。市集、島上、小吃多半只收現金。' },
  { id: 'esim', from: '2027-01-11', to: '2027-01-31', title: '買 eSIM 或網卡', text: '先確認手機支援 eSIM。一落地就要用 Grab、地圖和 LINE。' },
  { id: 'card', from: '2027-01-18', to: '2027-01-31', title: '信用卡開通海外刷卡', text: '確認額度、海外交易與預借現金密碼，記下信用卡掛失電話。' },
  { id: 'pack', from: '2027-01-25', to: '2027-01-31', title: '開始收行李', text: '行動電源只能放隨身行李、不能托運；電子煙不要帶。寺廟要遮肩過膝的衣服。可以對照下面的行李項目。' },
  { id: 'tdac-br', group: '長榮組', from: '2027-01-29', to: '2027-02-01', title: '填 TDAC 電子入境卡', text: '2/1 抵達泰國，在 1/29～2/1 之間到官方網站填寫，免費。不要用會收費的代辦網站。', link: TDAC_LINK },
  { id: 'checkin-br', group: '長榮組', from: '2027-01-30', to: '2027-02-01', title: '線上報到、選位', text: '長榮航空開放線上報到後就可以辦，順便確認行李額度。' },
  { id: 'go-br', group: '長榮組', from: '2027-02-01', to: '2027-02-01', title: '17:45 前到桃園機場 T2', text: 'BR205 20:45 起飛，建議提早 3 小時到。護照、手機、充電線、行動電源放隨身包。' },
  { id: 'tdac-cx', group: '國泰組', from: '2027-02-02', to: '2027-02-04', title: '填 TDAC 電子入境卡', text: '2/5 凌晨抵達泰國，在 2/2～2/4 出發前到官方網站填好（入境日期填 2/5），免費。', link: TDAC_LINK },
  { id: 'checkin-cx', group: '國泰組', from: '2027-02-03', to: '2027-02-04', title: '線上報到、選位', text: '國泰航空開放線上報到後就可以辦，香港轉機的兩段都要確認。' },
  { id: 'go-cx', group: '國泰組', from: '2027-02-04', to: '2027-02-04', title: '15:40 前到桃園機場 T1', text: 'CX473 18:40 起飛，建議提早 3 小時到。' },
];
let prepDone = {};
try { prepDone = JSON.parse(localStorage.getItem(PREP_KEY)) || {}; } catch {}
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
function prepItems() {
  const gs = tripGroups(), g = gs.includes(myGroup) ? myGroup : '';
  // 選的組別沒有自己的提醒（例如上海組）時，各組的提醒都顯示，免得漏掉 TDAC
  const own = g && PREP.some(p => p.group === g);
  return PREP.filter(p => !p.group || !own || p.group === g);
}
function prepState(p, t = bkkDate()) { return prepDone[p.id] ? 'done' : t > p.to ? 'late' : t >= p.from ? 'now' : 'soon'; }
function renderPrep() {
  const t = bkkDate(), items = prepItems(), list = $('#prep-list');
  if (list) {
    const label = { now: '現在該做', late: '已過期限', done: '做好了' };
    const done = items.filter(p => prepDone[p.id]).length;
    list.innerHTML = `<div class="section-top"><div><h3>出發前要做的事</h3><p class="muted">照日期提醒，做好了就勾起來（<span class="sync-off">只存在這台裝置</span><span class="sync-on">會同步到其他裝置</span>）。已完成 ${done} / ${items.length} 項。</p></div></div><ol class="prep-items">${items.map(p => { const s = prepState(p, t); return `<li class="prep-item ${s}"><label><input type="checkbox" data-prep="${p.id}"${prepDone[p.id] ? ' checked' : ''}><span class="prep-when">${md(p.to)}${p.from === p.to ? ' 當天' : ' 前'}</span><span class="prep-main"><b>${esc(p.title)}</b>${p.group && tripGroups().includes(p.group) ? `<span class="pill group-pill">${esc(p.group)}</span>` : ''}<span class="prep-tag">${s === 'soon' ? md(p.from) + ' 起' : label[s]}</span><small>${esc(p.text)}</small></span></label>${p.link ? `<a class="text-btn prep-link" href="${p.link[0]}" target="_blank" rel="noopener noreferrer">${esc(p.link[1])}</a>` : ''}</li>`; }).join('')}</ol>`;
  }
  const box = $('#prep-alert'); if (!box) return;
  let hidden = ''; try { hidden = localStorage.getItem(PREP_HIDE_KEY) || ''; } catch {}
  const due = items.filter(p => ['now', 'late'].includes(prepState(p, t))).sort((a, b) => a.to.localeCompare(b.to));
  if (!due.length || hidden === t || t > '2027-02-04') { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div><b>出發前提醒：現在該做 ${due.length} 件事</b><ul>${due.slice(0, 3).map(p => `<li>${esc(p.title)}<span>${prepState(p, t) === 'late' ? '已過 ' + md(p.to) : md(p.to) + (p.from === p.to ? ' 當天' : ' 前')}</span></li>`).join('')}${due.length > 3 ? `<li>…還有 ${due.length - 3} 件</li>` : ''}</ul></div><div class="prep-alert-actions"><button type="button" class="primary" data-prep-open>看全部</button><button type="button" class="quiet" data-prep-hide>今天先不提醒</button></div>`;
}
$('#prep-list')?.addEventListener('change', e => {
  const id = e.target.dataset.prep; if (!id) return;
  if (e.target.checked) prepDone[id] = true; else delete prepDone[id];
  try { localStorage.setItem(PREP_KEY, JSON.stringify(prepDone)); } catch {}
  renderPrep();
});
$('#prep-alert')?.addEventListener('click', e => {
  if (e.target.closest('[data-prep-open]')) { showTab('notes'); $('#prep-list').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }
  if (e.target.closest('[data-prep-hide]')) { try { localStorage.setItem(PREP_HIDE_KEY, bkkDate()); } catch {} renderPrep(); }
});
$('#group-pick')?.addEventListener('click', () => setTimeout(renderPrep));

/* ── 匯率換算（旅途工具）：用和「旅費記帳」匯率表一樣的匯率（有填「我的匯率」就用自己的） ── */
function fxLine() {
  const r = fxRate(), b = fx.bot;
  if (state.rate !== '') return `用你在「旅費記帳」匯率表填的匯率：1 泰銖 = ${esc(state.rate)} 台幣`;
  if (b) return `臺灣銀行 ${md(b.time.slice(0, 10))} ${b.time.slice(11)} ${RATE_KINDS[state.rateKind][0]}：1 泰銖 = ${r.toFixed(4)} 台幣。可以在「旅費記帳」的匯率表改用自己的匯率。`;
  if (fx.source === 'builtin') return `暫用內建參考匯率：1 泰銖 ≈ ${r.toFixed(3)} 台幣（連上網路後會自動更新）`;
  return `${md(fx.date)} 的國際參考匯率：1 泰銖 ≈ ${r.toFixed(3)} 台幣（暫時讀不到臺灣銀行匯率）。`;
}
const fxRound = n => n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
function renderFxBox() {
  const box = $('#fx-box'); if (!box) return;
  if (!box.firstChild) {
    box.innerHTML = `<details class="note-section tool-section" data-section="fx" open><summary><span class="note-num">฿</span><span class="note-title">匯率換算</span></summary><div class="tool-body"><div class="fx-pair"><label>泰銖 ฿<input id="fx-thb" type="number" inputmode="decimal" min="0" step="any" placeholder="例如 350"></label><span class="fx-eq" aria-hidden="true">＝</span><label>台幣 NT$<input id="fx-twd" type="number" inputmode="decimal" min="0" step="any" placeholder="自動算"></label></div><div class="chips fx-quick" role="group" aria-label="常用金額">${[20, 50, 100, 500, 1000].map(n => `<button type="button" class="chip" data-fx="${n}">฿${n}</button>`).join('')}</div><p class="muted fx-line"></p></div></details>`;
    const thb = $('#fx-thb'), twd = $('#fx-twd');
    thb.addEventListener('input', () => { twd.value = thb.value === '' ? '' : fxRound(+thb.value * fxRate()); });
    twd.addEventListener('input', () => { thb.value = twd.value === '' ? '' : fxRound(+twd.value / fxRate()); });
    box.addEventListener('click', e => { const b = e.target.closest('[data-fx]'); if (b) { thb.value = b.dataset.fx; thb.dispatchEvent(new Event('input')); } });
  }
  box.querySelector('.fx-line').innerHTML = fxLine();
  const thb = $('#fx-thb'); if (thb.value !== '') thb.dispatchEvent(new Event('input'));
}
document.querySelector('.tabs [data-tab="tools"]')?.addEventListener('click', () => { renderFxBox(); fx.refresh().then(changed => { if (changed) renderFxBox(); }); });

/* ── 一頁列印版：整趟行程濃縮成一張 A4，可以印出來或存成 PDF。依「我的組別」篩選。 ── */
function renderPrint() {
  const D = window.TRIP_DATA, gs = tripGroups(), g = gs.includes(myGroup) ? myGroup : '', sheet = $('#print-sheet');
  if (!sheet) return;
  const now = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
  const days = Array.from({ length: 10 }, (_, i) => {
    const d = i + 1, ev = visibleEvents(d), meet = meetOf(d), br = bringOf(d), hotel = String(D.hotels[d] || '').trim();
    return `<section class="ps-day" data-dow="${dowOf(d)}"><h3><b>2/${d}（${weekdays[d - 1]}）</b>${esc(D.titles[d] || '')}</h3>${meet ? `<p class="ps-meet">集合　${esc(meet)}</p>` : ''}<ul>${ev.map(e => `<li><time>${esc(e.time || '')}</time><span>${esc(e.title)}${!g && e.group && gs.includes(e.group) ? `<i>${esc(e.group)}</i>` : ''}${e.optional ? '<i>自選</i>' : ''}${e.dine === 'booked' ? '<i>已訂位</i>' : ''}</span></li>`).join('')}</ul>${hotel && d < 10 ? `<p class="ps-small"><b>住</b>${esc(hotel)}</p>` : ''}${br ? `<p class="ps-small"><b>帶</b>${esc(br)}</p>` : ''}</section>`;
  }).join('');
  sheet.innerHTML = `<header><h1>泰好時光｜2027 芭達雅・曼谷 行程表</h1><p>2027/2/1–2/10・${g ? esc(g) + '的行程' : '全團行程'}・共同行程第 ${cloudRevision ?? '—'} 版・${esc(now)} 列印</p></header><div class="ps-days">${days}</div><footer><p><b>緊急</b>觀光警察 1155・報警 191・救護車 1669・駐泰辦事處急難救助 +66 81 666 4006・外交部急難救助 +886 800 085 095</p><p><b>飯店</b>Mercure Pattaya Ocean Resort +66 38 769 688・ibis Styles Bangkok Ratchada +66 2 820 8888</p><p>時間為各地當地時間；最新行程請看網站 ${esc(location.origin + location.pathname)}</p></footer>`;
}
$('#print-btn')?.addEventListener('click', () => { renderPrint(); window.print(); });
window.addEventListener('beforeprint', renderPrint);

/* ── 顯示設定：外觀（跟著手機／淺色／深色）與字體大小，只存在這台裝置。
   index.html 的 <head> 有一小段程式，在畫面出現前就套用，避免閃一下。 */
const DISPLAY_KEY = 'thai-days-display-v1';
function readDisplay() { try { return JSON.parse(localStorage.getItem(DISPLAY_KEY)) || {}; } catch { return {}; } }
function applyDisplay(p) {
  const root = document.documentElement;
  if (p.theme === 'light' || p.theme === 'dark') root.dataset.theme = p.theme; else delete root.dataset.theme;
  if (p.size === 'large') root.dataset.size = 'large'; else delete root.dataset.size;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (!m.dataset.orig) m.dataset.orig = m.content;
    m.content = p.theme === 'light' ? '#EDF0EB' : p.theme === 'dark' ? '#2C3033' : m.dataset.orig;
  });
}
const displayDlg = $('#display-dialog');
if (displayDlg) {
  applyDisplay(readDisplay());
  $('#display-btn').addEventListener('click', () => {
    const p = readDisplay(), f = displayDlg.querySelector('form');
    f.elements.theme.value = ['light', 'dark'].includes(p.theme) ? p.theme : 'auto';
    f.elements.size.value = p.size === 'large' ? 'large' : 'normal';
    displayDlg.showModal();
  });
  displayDlg.addEventListener('change', () => {
    const f = displayDlg.querySelector('form'), p = { theme: f.elements.theme.value, size: f.elements.size.value };
    try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(p)); } catch {}
    applyDisplay(p);
  });
  displayDlg.addEventListener('click', e => { if (e.target === displayDlg) displayDlg.close(); });
}

/* ── 主辦人：歷史版本（編輯共同行程 → 歷史版本）──
   每次儲存都是 GitHub 上的一筆紀錄。可以挑一個舊版本，看它和目前編輯中的內容哪裡不同，
   並把它載回編輯視窗；還要按「儲存並同步給旅伴」才會真的生效（會存成新的一版，舊紀錄都還在）。 */
let historyList = null;
const twTime = s => new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function tripDiff(a, b) {
  const x = tripDigest(a), y = tripDigest(b), out = [];
  const days = []; for (let d = 1; d <= 10; d++) if (x.days[d] !== y.days[d]) days.push('2/' + d);
  if (days.length) out.push(days.join('、'));
  if (x.intro !== y.intro || JSON.stringify(a.groups || []) !== JSON.stringify(b.groups || [])) out.push('首頁與總覽');
  if (x.checklist !== y.checklist) out.push('出發清單');
  if (JSON.stringify(a.split || null) !== JSON.stringify(b.split || null)) out.push('團體分帳');
  if (JSON.stringify(a.todos || []) !== JSON.stringify(b.todos || [])) out.push('待辦');
  if (JSON.stringify(a.roster || []) !== JSON.stringify(b.roster || [])) out.push('旅伴名單');
  return out;
}
async function renderHistory() {
  const box = $('#history-editor'); if (!box || !draft) return;
  box.innerHTML = '<p class="ed-help">每次按「儲存」都會留下一個版本。點「看這版」可以比較和現在的差別；還原後要再按下面的「儲存並同步給旅伴」才會生效，舊的版本都還會留著。</p><p class="muted">正在向 GitHub 讀取歷史版本…</p>';
  try {
    const r = await github('/commits?path=' + encodeURIComponent(GH.path) + '&per_page=30' + (GH.branch ? '&sha=' + encodeURIComponent(GH.branch) : ''), hostToken);
    if (!r.ok) throw Error();
    historyList = await r.json();
    if (!draft) return;
    box.querySelector('.muted').outerHTML = `<ol class="history-list">${historyList.map((c, i) => `<li data-sha="${esc(c.sha)}"><div class="history-row"><div><b>${esc(String(c.commit.message).split('\n')[0])}</b><small>${esc(twTime(c.commit.committer.date))}（台灣時間）${i === 0 ? '・目前雲端上的版本' : ''}</small></div><button type="button" class="text-btn" data-hist="${esc(c.sha)}">看這版</button></div><div class="history-detail" hidden></div></li>`).join('')}</ol>${historyList.length >= 30 ? '<p class="muted">只列出最近 30 個版本；更早的可以到 GitHub 的歷史紀錄查看。</p>' : ''}`;
  } catch {
    if (draft) box.querySelector('.muted').outerHTML = '<p class="ed-warn ed-help">讀不到歷史版本，請確認網路後再試。</p><button type="button" class="quiet" data-hist-retry>重新讀取</button>';
  }
}
const historyBox = $('#history-editor');
if (historyBox) {
  const loaded = {};
  historyBox.addEventListener('click', async e => {
    if (!draft || saving) return;
    if (e.target.closest('[data-hist-retry]')) return renderHistory();
    const b = e.target.closest('[data-hist]'), restore = e.target.closest('[data-hist-restore]');
    if (b) {
      const li = b.closest('li'), detail = li.querySelector('.history-detail'), sha = b.dataset.hist;
      if (!detail.hidden) { detail.hidden = true; b.textContent = '看這版'; return; }
      detail.hidden = false; b.textContent = '收起'; detail.innerHTML = '<p class="muted">讀取中…</p>';
      try {
        if (!loaded[sha]) {
          const r = await github(repoFile() + '?ref=' + encodeURIComponent(sha), hostToken);
          if (!r.ok) throw Error('讀不到這一版，請稍後再試。');
          const trip = JSON.parse(fromBase64((await r.json()).content));
          if (!validTrip(trip)) throw Error('這一版的格式太舊，沒辦法直接還原。');
          loaded[sha] = trip;
        }
        if (!draft) return;
        const trip = loaded[sha], diff = tripDiff(trip.data, draft);
        detail.innerHTML = `<p>第 ${trip.revision} 版${trip.updatedAt ? '・' + esc(twTime(trip.updatedAt)) : ''}：${diff.length ? '和你現在編輯中的內容比，不一樣的是 <b>' + esc(diff.join('、')) + '</b>' : '和你現在編輯中的內容完全一樣'}。</p>${diff.length ? `<button type="button" class="quiet" data-hist-restore="${esc(sha)}">還原成這一版</button>` : ''}`;
      } catch (err) { detail.innerHTML = `<p class="ed-warn ed-help">${esc(err instanceof TypeError ? '無法連線到 GitHub，請檢查網路後再試。' : err.message)}</p>`; }
    }
    if (restore) {
      const trip = loaded[restore.dataset.histRestore]; if (!trip) return;
      if (!confirm(`把編輯視窗的內容換成第 ${trip.revision} 版？\n你這次還沒儲存的修改會被取代。換好後要按「儲存並同步給旅伴」才會生效。`)) return;
      draft = structuredClone(trip.data);
      fillEditor();
      $('#save-status').textContent = `已載入第 ${trip.revision} 版的內容。確認沒問題後按「儲存並同步給旅伴」，會存成新的一版。`;
      renderHistory();
    }
  });
  document.querySelector('#cloud-editor .ed-nav')?.addEventListener('click', e => { if (e.target.closest('[data-pane="history"]')) renderHistory(); });
}

renderPrep();
renderFxBox();
renderDay();
