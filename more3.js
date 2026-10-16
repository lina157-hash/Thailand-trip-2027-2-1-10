/* 第五輪功能：分享網站 QR Code、第一次使用教學、航班動態、空氣品質、傳我的位置、
   伴手禮／代購清單、換匯小指南、台灣／泰國雙時鐘。（「我想去」收藏在 app.js 的旅遊靈感裡） */

const siteUrl = () => location.origin + location.pathname;
const lineShare = text => `https://line.me/R/share?text=${encodeURIComponent(text)}`;
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('已複製'); } catch { prompt('請長按複製：', t); } }

/* ── 台灣／泰國雙時鐘（泰國比台灣慢 1 小時） ── */
function renderClock() {
  const el = $('#dual-clock'); if (!el) return;
  const t = tz => new Intl.DateTimeFormat('zh-TW', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  el.innerHTML = `🇹🇼 台灣 <b>${t('Asia/Taipei')}</b>　🇹🇭 泰國 <b>${t('Asia/Bangkok')}</b>`;
}
renderClock(); setInterval(renderClock, 20000);

/* ── 航班即時動態：活動標題裡有航班號（BR205、CX617…）就加一個 Google 航班狀態連結 ──
   Google 搜尋航班號會在最上面顯示當天（或下一班）的中文狀態卡：準時／延誤、航廈、登機門。
   （Flightradar24 的航班頁主要是歷史紀錄，旅伴不好看懂，所以不用。） */
const FLIGHT_RE = /\b(BR|CX|CI|TG|JX)\s?(\d{2,4})\b/g;
const flightUrl = code => `https://www.google.com/search?hl=zh-TW&q=${encodeURIComponent(code + ' 航班狀態')}`;
function flightLink(e) {
  const codes = [...new Set([...String(e.title || '').matchAll(FLIGHT_RE)].map(m => m[1] + m[2]))];
  return codes.length ? `<p class="flight-links">${codes.map(c => `<a href="${flightUrl(c)}" target="_blank" rel="noopener noreferrer">✈ ${c} 即時動態</a>`).join('')}</p>` : '';
}
/* 首頁「航班、住宿…」的航班欄：把裡面提到的航班都列成即時動態連結（共同行程更新後會重畫，所以每次都重加） */
function flightInfoLinks() {
  const box = document.querySelector('.info-grid > div'); if (!box || box.querySelector('.flight-links')) return;
  const codes = [...new Set([...box.textContent.matchAll(FLIGHT_RE)].map(m => m[1] + m[2]))];
  if (codes.length) box.insertAdjacentHTML('beforeend', `<p class="flight-links"><span class="muted">即時動態（延誤、登機門）：</span>${codes.map(c => `<a href="${flightUrl(c)}" target="_blank" rel="noopener noreferrer">✈ ${c}</a>`).join('')}</p>`);
}
flightInfoLinks();

/* ── 分享網站：QR Code（集合時給旅伴掃）、傳到 LINE、複製連結 ── */
function loadQr() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'lib/qrcode.js'; s.onload = ok; s.onerror = fail; document.head.append(s); });
}
const shareDlg = $('#share-dialog');
async function openShare() {
  const url = siteUrl(), box = $('#share-body');
  box.innerHTML = `<div class="qr-box" aria-label="網站 QR Code"><p class="muted">產生中…</p></div><p class="share-url">${esc(url)}</p><div class="share-actions"><a class="primary" href="${lineShare('泰好時光 2027 芭達雅・曼谷 行程網站：' + url)}" target="_blank" rel="noopener noreferrer">傳到 LINE</a><button type="button" class="quiet" data-share-copy>複製連結</button>${navigator.share ? '<button type="button" class="quiet" data-share-more>其他 App</button>' : ''}</div><p class="muted">旅伴用手機相機對準 QR Code 就能打開。打開後建議「加到主畫面」，像 App 一樣一點就開。</p>`;
  shareDlg.showModal();
  try {
    await loadQr();
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    box.querySelector('.qr-box').innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch { box.querySelector('.qr-box').innerHTML = '<p class="muted">QR Code 需要網路才能產生，可以先用下面的按鈕分享。</p>'; }
}
if (shareDlg) {
  document.addEventListener('click', e => { if (e.target.closest('[data-share-open]')) openShare(); });
  shareDlg.addEventListener('click', e => {
    if (e.target === shareDlg || e.target.closest('[data-share-close]')) return shareDlg.close();
    if (e.target.closest('[data-share-copy]')) copyText(siteUrl());
    if (e.target.closest('[data-share-more]')) navigator.share({ title: '泰好時光', text: '2027 芭達雅・曼谷 行程網站', url: siteUrl() }).catch(() => {});
  });
}

/* ── 第一次使用教學：3 步驟（選組別、看今天、加到主畫面）。看過就不再自動跳出，旅途工具裡可以再打開 ── */
const GUIDE_KEY = 'thai-days-guide-v1';
let guideStep = 0, installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function guideSteps() {
  const gs = tripGroups(), cur = gs.includes(myGroup) ? myGroup : '';
  return [
    { t: '選你的組別', b: gs.length ? `<p>大家搭的航班不一樣，選了自己的組別，每日行程就只會顯示你那組的安排。</p><div class="chips guide-groups">${['', ...gs].map(g => `<button type="button" class="chip${g === cur ? ' active' : ''}" data-guide-group="${esc(g)}" aria-pressed="${g === cur}">${g ? esc(g) : '看全部'}</button>`).join('')}</div><p class="muted">之後也可以在「每日行程」最上面改。</p>` : '<p>每日行程會列出每天的安排、集合時間和地圖。點地點就會打開 Google 地圖。</p>' },
    { t: '看「今天」和下面的分頁', b: '<p>旅途中，最上面會出現「今天」卡片：現在要做什麼、下一個行程、集合時間。</p><p>畫面下方的按鈕可以切換：<b>每日行程</b>、<b>旅遊靈感</b>、<b>旅費記帳</b>、<b>出發清單</b>、<b>注意事項</b>、<b>旅途工具</b>（給司機看的地址、緊急電話、走散時傳位置）。</p>' },
    { t: '加到手機主畫面', b: isStandalone() ? '<p>你已經把網站加到主畫面了 👍 之後從主畫面的圖示打開就好，沒網路時也看得到。</p>'
      : isIos() ? '<ol class="guide-ol"><li>用 <b>Safari</b> 打開這個網站</li><li>點下方（或上方）的 <b>分享</b> 按鈕 <span class="ios-share" aria-hidden="true">⬆︎</span></li><li>往下滑，點 <b>加入主畫面</b></li><li>右上角點 <b>新增</b></li></ol><p class="muted">之後從主畫面的圖示打開，就像 App 一樣，沒網路時也看得到。</p>'
      : `${installEvt ? '<p><button type="button" class="primary" data-guide-install>一鍵加到主畫面</button></p>' : ''}<ol class="guide-ol"><li>用 <b>Chrome</b> 打開這個網站</li><li>點右上角 <b>⋮</b></li><li>點 <b>加到主畫面</b>（或「安裝應用程式」）</li></ol><p class="muted">之後從主畫面的圖示打開，就像 App 一樣，沒網路時也看得到。</p>` },
  ];
}
const guideDlg = $('#guide-dialog');
function renderGuide() {
  const steps = guideSteps(), s = steps[guideStep];
  $('#guide-body').innerHTML = `<p class="guide-dots" aria-label="第 ${guideStep + 1} 步，共 ${steps.length} 步">${steps.map((_, i) => `<span class="${i === guideStep ? 'on' : ''}"></span>`).join('')}</p><h3>${guideStep + 1}. ${s.t}</h3>${s.b}<div class="guide-nav">${guideStep ? '<button type="button" class="quiet" data-guide-prev>上一步</button>' : '<button type="button" class="quiet" data-guide-done>之後再看</button>'}${guideStep < steps.length - 1 ? '<button type="button" class="primary" data-guide-next>下一步</button>' : '<button type="button" class="primary" data-guide-done>開始使用</button>'}</div>`;
}
function openGuide() { guideStep = 0; renderGuide(); guideDlg.showModal(); }
if (guideDlg) {
  guideDlg.addEventListener('close', () => { try { localStorage.setItem(GUIDE_KEY, '1'); } catch {} });
  guideDlg.addEventListener('click', e => {
    if (e.target.closest('[data-guide-next]')) { guideStep++; return renderGuide(); }
    if (e.target.closest('[data-guide-prev]')) { guideStep--; return renderGuide(); }
    if (e.target.closest('[data-guide-done]')) return guideDlg.close();
    const g = e.target.closest('[data-guide-group]');
    if (g) { $(`#group-pick [data-group="${CSS.escape(g.dataset.guideGroup)}"]`)?.click(); return renderGuide(); }
    if (e.target.closest('[data-guide-install]') && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; renderGuide(); }); }
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-guide-open]')) openGuide(); });
  let seen = false; try { seen = !!localStorage.getItem(GUIDE_KEY); } catch {}
  // 自動化測試（navigator.webdriver）和列印時不自動跳出
  if (!seen && !navigator.webdriver) setTimeout(() => { if (!document.querySelector('dialog[open]')) openGuide(); }, 800);
}

/* ── 空氣品質：Open-Meteo 的 PM2.5 與美國 AQI（免費、不需帳號），每小時更新。
   1、2 月是曼谷空汙最嚴重的季節；旅途中每日行程的天氣後面也會標出當天的空氣品質。 ── */
const AQ_KEY = 'thai-days-aqi-v1';
let aqData = null;
try { const c = JSON.parse(localStorage.getItem(AQ_KEY)); if (c && c.data) aqData = c; } catch {}
const AQ_LEVEL = a => a <= 50 ? ['🟢', '良好', ''] : a <= 100 ? ['🟡', '普通', '一般人可以正常活動。'] : a <= 150 ? ['🟠', '對敏感族群不健康', '長輩、小孩、有氣喘或心肺疾病的人，建議戴口罩、減少在戶外久待。'] : a <= 200 ? ['🔴', '不健康', '建議大家外出都戴口罩（醫療口罩或 N95），減少在戶外久待。'] : ['🟣', '非常不健康', '盡量待在室內，外出一定要戴 N95 口罩。'];
function aqiFor(city, date) {
  const d = aqData?.data?.[city]?.days?.[date];
  if (d == null) return '';
  const [dot, label] = AQ_LEVEL(d);
  return `・空氣${dot}${label}`;
}
async function refreshAqi() {
  if (aqData && Date.now() - aqData.at < 3600000) return renderAqiBox();
  try {
    const data = {};
    for (const [key, c] of Object.entries(WX_CITY)) {
      const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=us_aqi,pm2_5&hourly=us_aqi&timezone=Asia%2FBangkok&forecast_days=5`);
      if (!r.ok) throw Error();
      const j = await r.json(), days = {};
      j.hourly.time.forEach((t, i) => { const v = j.hourly.us_aqi[i], d = t.slice(0, 10); if (v != null && (days[d] == null || v > days[d])) days[d] = v; });
      data[key] = { now: j.current?.us_aqi, pm: j.current?.pm2_5, time: j.current?.time, days };
    }
    aqData = { at: Date.now(), data };
    try { localStorage.setItem(AQ_KEY, JSON.stringify(aqData)); } catch {}
    if (todayDay || bkkDate() >= '2027-01-27') renderDay();
  } catch {}
  renderAqiBox();
}
function renderAqiBox() {
  const box = $('#aqi-box'); if (!box) return;
  const rows = Object.entries(WX_CITY).map(([k, c]) => [c.name, aqData?.data?.[k]]).filter(([, v]) => v && v.now != null);
  const worst = Math.max(0, ...rows.map(([, v]) => v.now)), tip = worst > 100 ? AQ_LEVEL(worst)[2] : '';
  box.innerHTML = `<details class="note-section tool-section" data-section="aqi"${worst > 100 ? ' open' : ''}><summary><span class="note-num">🌫</span><span class="note-title">空氣品質 PM2.5</span></summary><div class="tool-body">${rows.length
    ? `<ul class="sos-list">${rows.map(([n, v]) => { const [dot, label] = AQ_LEVEL(v.now); return `<li><span>${n}</span><span>${dot} ${label}・AQI ${Math.round(v.now)}${v.pm != null ? `・PM2.5 ${Math.round(v.pm)}` : ''}</span></li>`; }).join('')}</ul>${tip ? `<p class="aqi-tip">${tip}</p>` : ''}<p class="muted">現在的數值，每小時更新。資料來自 <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>（美國 AQI 標準）。</p>`
    : '<p class="muted">連上網路後會顯示芭達雅和曼谷現在的空氣品質。</p>'}<p class="muted">1、2 月是曼谷空汙最嚴重的季節，建議每人帶幾個口罩（醫療口罩或 N95），長輩和有氣喘的人尤其需要。</p></div></details>`;
}
renderAqiBox(); setTimeout(refreshAqi, 1500);

/* ── 走散了？傳我的位置：用手機定位，一鍵傳到 LINE 群組 ── */
function renderLocBox() {
  const box = $('#loc-box'); if (!box) return;
  box.innerHTML = `<div class="loc-card"><div><h3>走散了？傳我的位置</h3><p class="muted">按一下，把你現在在哪裡傳到 LINE 群組，大家就能來找你。</p></div><button type="button" class="primary" data-loc>📍 傳我的位置</button><div id="loc-result" aria-live="polite"></div></div>`;
}
renderLocBox();
document.addEventListener('click', e => {
  if (!e.target.closest('[data-loc]')) return;
  const out = $('#loc-result');
  if (!navigator.geolocation) return out.innerHTML = '<p class="loc-err">這支手機不支援定位。可以打開 LINE 聊天室的「＋」→「位置資訊」傳送。</p>';
  out.innerHTML = '<p class="muted">定位中…（第一次會問你要不要允許，請按「允許」）</p>';
  navigator.geolocation.getCurrentPosition(p => {
    const { latitude: la, longitude: lo, accuracy: ac } = p.coords, time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const msg = `我在這裡（泰國時間 ${time}，誤差約 ${Math.round(ac)} 公尺）：https://www.google.com/maps?q=${la.toFixed(6)},${lo.toFixed(6)}`;
    out.innerHTML = `<p class="loc-msg">${esc(msg)}</p><div class="share-actions"><a class="primary" href="${lineShare(msg)}" target="_blank" rel="noopener noreferrer">傳到 LINE</a>${navigator.share ? '<button type="button" class="quiet" data-loc-share>其他 App</button>' : ''}<button type="button" class="quiet" data-loc-copy>複製</button></div><p class="muted">要回飯店？往下打開「給司機看」，把泰文地址拿給司機。</p>`;
    out.dataset.msg = msg;
  }, err => {
    out.innerHTML = `<p class="loc-err">${err.code === 1 ? '沒有定位權限。請到手機的「設定」允許瀏覽器使用位置，或打開 LINE 聊天室的「＋」→「位置資訊」傳送。' : '暫時定位不到，請到空曠處再試一次，或用 LINE 聊天室的「＋」→「位置資訊」傳送。'}</p>`;
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
});
document.addEventListener('click', e => {
  const msg = $('#loc-result')?.dataset.msg; if (!msg) return;
  if (e.target.closest('[data-loc-copy]')) copyText(msg);
  if (e.target.closest('[data-loc-share]')) navigator.share({ text: msg }).catch(() => {});
});

/* ── 換匯小指南＋換匯計算：換匯所的牌價和臺灣銀行比，看哪邊划算 ── */
const EX_KEY = 'thai-days-exchange-v1';
function renderExchangeBox() {
  const box = $('#exchange-box'); if (!box) return;
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(EX_KEY)) || {}; } catch {}
  box.innerHTML = `<details class="note-section tool-section" data-section="exchange"><summary><span class="note-num">💱</span><span class="note-title">換匯小指南</span></summary><div class="tool-body exchange">
<h4>在台灣</h4><p>銀行可以直接換泰銖現金，價格看「旅費記帳」匯率表的<b>臺銀現金賣出</b>。建議至少先換好頭兩三天要用的錢。<b>長榮組 23:40 才落地</b>，出關時機場換匯所多半快關了，第一天的錢一定要在台灣先換好。</p>
<h4>曼谷機場（素萬那普）</h4><p>往下走到 <b>B 層</b>（機場快線 Airport Rail Link 那層），有 SuperRich（橘色，約 05:30–23:30）和 Happy Rich（約 05:00–24:00），匯率比入境大廳的銀行櫃台好很多（大廳通常差 7% 左右）。</p>
<h4>芭達雅</h4><p><b>TT Exchange</b> 分店很多（約 09:00–21:00，各店不同，官網 ttexchange.com 可查牌價）。2026 年 <b>Central Pattaya</b> 1 樓開了綠色 SuperRich、<b>Terminal 21 Pattaya</b> 開了橘色 SuperRich，去之前先查營業時間。</p>
<h4>曼谷市區</h4><p>BTS <b>Chit Lom</b> 站旁有 SuperRich 橘色、綠色的總店；BTS <b>Asok</b> 1 號出口也有橘色分店。百貨裡的分店通常晚上 7、8 點關。<b>換匯要帶護照正本。</b></p>
<h4>ATM 與刷卡</h4><p>泰國 ATM 用台灣的卡提款，每次收 <b>220 泰銖</b>手續費（AEON 的 ATM 150 泰銖），台灣銀行另外還有海外手續費，最好一次領多一點。ATM 或刷卡機問要不要「換成台幣」時，選<b>泰銖（不轉換）</b>，換成台幣的匯率比較差。</p>
<h4>換匯計算</h4><p class="muted">看換匯所牌子上 TWD 那一行的 <b>Buying（買入）</b>，就是 1 台幣能換幾泰銖。</p>
<div class="inline"><label>換匯所：1 台幣換幾泰銖<input type="number" step="0.0001" min="0.5" max="2" inputmode="decimal" data-ex="rate" value="${esc(saved.rate || '')}" placeholder="例如 0.99"></label><label class="narrow">要換多少台幣<input type="number" step="100" min="0" inputmode="numeric" data-ex="amt" value="${esc(saved.amt || '10000')}"></label></div>
<p class="ex-result" aria-live="polite"></p>
<p class="muted">資料來源：<a href="https://thaiest.com/en/blog/best-currency-exchange-rates-at-suvarnabhumi-airport" target="_blank" rel="noopener noreferrer">Thaiest 機場換匯</a>、<a href="https://roo.cash/blog/?p=108637" target="_blank" rel="noopener noreferrer">泰國換匯所攻略</a>、<a href="https://nashaplaneta.net/blog/4-mesta-v-pattaye-gde-menyat-dengi_en" target="_blank" rel="noopener noreferrer">芭達雅換匯</a>、<a href="https://www.thailandstarterkit.com/money/atm-thailand/" target="_blank" rel="noopener noreferrer">泰國 ATM</a>（2026 年資料，營業時間可能變動）。</p>
</div></details>`;
  calcExchange();
}
function calcExchange() {
  const box = $('#exchange-box'); if (!box || !box.querySelector('.ex-result')) return;
  const r = +box.querySelector('[data-ex=rate]').value, amt = +box.querySelector('[data-ex=amt]').value;
  const bot = fx.bot?.cashSell || fx.rate, viaBot = amt / bot, name = fx.bot ? '臺銀現金賣出' : '參考匯率';
  const f = n => '฿ ' + Math.round(n).toLocaleString('zh-TW');
  if (!(amt > 0)) return box.querySelector('.ex-result').textContent = '';
  if (!(r > 0)) return box.querySelector('.ex-result').innerHTML = `在台灣用${name}（1 泰銖 = ${bot.toFixed(4)} 台幣）換 NT$ ${amt.toLocaleString('zh-TW')}，大約拿到 <b>${f(viaBot)}</b>。填上換匯所的牌價就能比較。`;
  const viaShop = amt * r, diff = viaShop - viaBot;
  box.querySelector('.ex-result').innerHTML = `換匯所：<b>${f(viaShop)}</b>　在台灣（${name}）：<b>${f(viaBot)}</b><br>${Math.abs(diff) < 1 ? '差不多一樣。' : diff > 0 ? `在泰國換匯所換比較划算，多拿 <b>${f(diff)}</b>。` : `在台灣換比較划算，多拿 <b>${f(-diff)}</b>。`}`;
}
document.addEventListener('input', e => {
  if (!e.target.closest('#exchange-box [data-ex]')) return;
  const b = $('#exchange-box');
  try { localStorage.setItem(EX_KEY, JSON.stringify({ rate: b.querySelector('[data-ex=rate]').value, amt: b.querySelector('[data-ex=amt]').value })); } catch {}
  calcExchange();
});
renderExchangeBox();
document.querySelector('.tabs [data-tab="tools"]')?.addEventListener('click', () => fx.refresh().then(() => calcExchange()));

/* ── 伴手禮／代購清單（獨立一頁）：要買什麼、幫誰買、在哪買，買到就打勾。只存在這台裝置（會跟著個人備份） ── */
let giftEditId = null;
function renderGifts() {
  const box = $('#gifts'); if (!box) return;
  const list = state.gifts || [], done = list.filter(g => g.done).length, edit = giftEditId && list.find(g => g.id === giftEditId);
  const f = edit || { what: '', who: '', where: '', price: '' };
  const row = g => `<li class="gift${g.done ? ' done' : ''}${g.id === giftEditId ? ' editing' : ''}"><label class="gift-check"><input type="checkbox" data-gift-done="${esc(g.id)}"${g.done ? ' checked' : ''}><span><b>${esc(g.what)}</b><small>${[g.who && '幫 ' + esc(g.who) + ' 買', g.where && '在 ' + esc(g.where), g.price !== '' && '約 ฿' + money(g.price)].filter(Boolean).join('・')}</small></span></label><span class="gift-btns"><button type="button" class="text-btn" data-gift-edit="${esc(g.id)}">修改</button><button type="button" class="text-btn danger" data-gift-del="${esc(g.id)}" aria-label="刪除 ${esc(g.what)}">刪除</button></span></li>`;
  const todo = list.filter(g => !g.done), got = list.filter(g => g.done);
  const pr = $('#gift-progress'); if (pr) pr.textContent = list.length ? `已買 ${done} / ${list.length} 樣` : '記下要買的東西，買到就打勾。';
  box.innerHTML = `<form id="gift-form" class="gift-form"><div class="inline"><label>要買什麼<input name="what" required maxlength="80" value="${esc(f.what)}" placeholder="例如：小老板海苔、五標青草膏"></label><label class="narrow">幫誰買<input name="who" maxlength="40" value="${esc(f.who)}" placeholder="選填"></label></div><div class="inline"><label>在哪買<input name="where" maxlength="60" value="${esc(f.where)}" placeholder="選填，例如 Big C、7-11"></label><label class="narrow">預算（泰銖）<input name="price" type="number" min="0" step="1" inputmode="numeric" value="${f.price === '' ? '' : esc(f.price)}" placeholder="選填"></label></div><div class="form-actions"><button class="primary">${edit ? '儲存修改' : '加入清單'}</button>${edit ? '<button type="button" class="quiet" data-gift-cancel>取消</button>' : ''}</div></form>`
    + (list.length ? `${todo.length ? `<ul class="gift-list">${todo.map(row).join('')}</ul>` : '<p class="muted">全部買齊了 🎉</p>'}${got.length ? `<p class="gift-sub">已買到</p><ul class="gift-list">${got.map(row).join('')}</ul>` : ''}` : '');
}
const giftBox = $('#gifts');
if (giftBox) {
  giftBox.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target), what = String(fd.get('what')).trim(); if (!what) return;
    const p = String(fd.get('price')).trim(), g = { id: giftEditId || uid(), what, who: String(fd.get('who')).trim().slice(0, 40), where: String(fd.get('where')).trim().slice(0, 60), price: p === '' || !(+p >= 0) ? '' : Math.min(1e7, Math.round(+p)), done: false };
    state.gifts = giftEditId ? state.gifts.map(x => x.id === giftEditId ? { ...g, done: x.done } : x) : [...(state.gifts || []), g];
    giftEditId = null; save(); renderGifts();
  });
  giftBox.addEventListener('change', e => {
    const id = e.target.dataset.giftDone; if (id === undefined) return;
    state.gifts = state.gifts.map(g => g.id === id ? { ...g, done: e.target.checked } : g); save(); renderGifts();
  });
  giftBox.addEventListener('click', e => {
    const ed = e.target.closest('[data-gift-edit]'); if (ed) { giftEditId = ed.dataset.giftEdit; renderGifts(); return $('#gift-form').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); }
    if (e.target.closest('[data-gift-cancel]')) { giftEditId = null; return renderGifts(); }
    const del = e.target.closest('[data-gift-del]');
    if (del) { const g = state.gifts.find(x => x.id === del.dataset.giftDel); if (g && confirm(`刪除「${g.what}」？`)) { state.gifts = state.gifts.filter(x => x !== g); if (giftEditId === g.id) giftEditId = null; save(); renderGifts(); } }
  });
  renderGifts();
}
