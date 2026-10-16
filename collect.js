/* 收款紀錄（主辦人登入後右上角出現「收款」）：記下出發前向每位旅伴收了多少旅費、哪天收的、怎麼付的。
 * 資料存在主辦人這台裝置的瀏覽器裡，旅伴完全看不到。
 * 「加密同步」（選用）：主辦人設一組同步密碼，紀錄用這組密碼加密（PBKDF2＋AES-GCM）後才存進儲存庫的 collect.enc.json，
 * 網站資料雖然公開，但沒有密碼的人只看得到亂碼；主辦人在別台裝置登入、輸入同一組密碼就能看到同一份紀錄。
 * 密碼只留在主辦人自己的裝置，不會上傳。也可以用「下載備份」「還原備份」「匯出 Excel」留檔。 */
const COLLECT_KEY = 'thai-days-collect-v1';
const PAY_METHODS = ['轉帳', '現金', 'LINE Pay', '其他'];
let collectEditId = null;

const validCollect = c => !!c && typeof c === 'object' && c.version === 1
  && c.due && typeof c.due === 'object' && !Array.isArray(c.due)
  && Object.entries(c.due).every(([k, v]) => typeof k === 'string' && k.length <= 40 && Number.isFinite(v) && v >= 0 && v <= 1e8)
  && Array.isArray(c.records) && c.records.every(r => r && typeof r.id === 'string' && typeof r.name === 'string' && r.name.trim() && r.name.length <= 40
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.amount) && r.amount > 0 && r.amount <= 1e8
    && typeof r.method === 'string' && r.method.length <= 20 && typeof r.note === 'string' && r.note.length <= 200)
  && (c.updatedAt === undefined || Number.isFinite(c.updatedAt))
  && (c.deleted === undefined || Array.isArray(c.deleted) && c.deleted.length <= 5000 && c.deleted.every(x => typeof x === 'string' && x.length <= 60));
function readCollect() { try { const c = JSON.parse(localStorage.getItem(COLLECT_KEY)); if (validCollect(c)) return c; } catch {} return { version: 1, due: {}, records: [] }; }
/* 每次修改都記下時間，並在幾秒後自動加密同步（有開同步的話）；keepTime＝同步合併回來的資料，不算新的修改 */
function writeCollect(c, keepTime) {
  if (!keepTime) c.updatedAt = Date.now();
  try { localStorage.setItem(COLLECT_KEY, JSON.stringify(c)); } catch { toast('儲存失敗，請先下載備份'); return false; }
  if (!keepTime && typeof scheduleCollectSync === 'function') scheduleCollectSync();
  return true;
}

const twDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const ntd = n => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const mdOf = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
/* 名單＝旅伴名單（編輯共同行程裡的點名名單）＋設過應收或收過錢的人，依名單順序 */
function collectPeople(c) {
  const names = rosterOf().map(p => p.name.trim());
  for (const n of [...Object.keys(c.due), ...c.records.map(r => r.name)]) if (!names.includes(n)) names.push(n);
  return names;
}
function collectRows(c) {
  return collectPeople(c).map(name => {
    const paid = c.records.filter(r => r.name === name).reduce((a, r) => a + r.amount, 0), due = c.due[name] || 0;
    return { name, due, paid, left: due - paid };
  });
}

function renderCollect() {
  const c = readCollect(), rows = collectRows(c), people = rows.map(r => r.name);
  const paid = rows.reduce((a, r) => a + r.paid, 0), due = rows.reduce((a, r) => a + r.due, 0);
  const done = rows.filter(r => r.due > 0 && r.left <= 0).length, withDue = rows.filter(r => r.due > 0).length;
  const edit = collectEditId && c.records.find(r => r.id === collectEditId);
  if (!edit) collectEditId = null;
  const f = edit || { name: '', date: twDate(), amount: '', method: PAY_METHODS[0], note: '' };
  const status = r => !r.due ? (r.paid ? '<span class="col-tag">已收</span>' : '<span class="col-tag muted">—</span>')
    : r.left <= 0 ? `<span class="col-tag ok">付清${r.left < 0 ? `・多 ${ntd(-r.left)}` : ''}</span>`
    : r.paid ? `<span class="col-tag part">還差 ${ntd(r.left)}</span>` : '<span class="col-tag no">未付</span>';
  const recs = c.records.map((r, i) => [r, i]).sort((a, b) => b[0].date.localeCompare(a[0].date) || b[1] - a[1]).map(x => x[0]); // 新的在上面

  $('#collect-body').innerHTML = `<div class="col-sum"><div><span class="eyebrow">已收</span><b>${ntd(paid)}</b></div>${due ? `<div><span class="eyebrow">應收</span><b>${ntd(due)}</b></div><div><span class="eyebrow">還沒收</span><b class="${due - paid > 0 ? 'col-left' : ''}">${ntd(Math.max(0, due - paid))}</b></div>` : ''}</div>`
    + (withDue ? `<p class="muted col-progress">${done} / ${withDue} 人付清</p>` : '')
    + `<form id="collect-form" class="col-form"><h3>${edit ? '修改這筆收款' : '記一筆收款'}</h3>`
    + `<label>誰付的<input name="name" required maxlength="40" list="collect-names" value="${esc(f.name)}" placeholder="點一下選名字，或直接輸入" autocomplete="off"></label>`
    + `<datalist id="collect-names">${people.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`
    + `<div class="inline"><label>金額（台幣）<input name="amount" type="number" min="1" max="100000000" step="1" inputmode="numeric" required value="${esc(f.amount)}" placeholder="例如 20000"></label><label class="narrow">方式<select name="method">${PAY_METHODS.map(m => `<option${m === f.method ? ' selected' : ''}>${m}</option>`).join('')}</select></label></div>`
    + `<label>收到的日期<input name="date" type="date" required value="${esc(f.date)}"></label>`
    + `<label>備註（選填）<input name="note" maxlength="200" value="${esc(f.note)}" placeholder="例如：第一期訂金、帳號末五碼 12345"></label>`
    + `<div class="form-actions"><button class="primary">${edit ? '儲存修改' : '記下這筆'}</button>${edit ? '<button type="button" class="quiet" data-col-cancel>取消修改</button>' : ''}</div></form>`
    + `<h3 class="col-h">每個人的狀況</h3>`
    + (rows.length ? `<div class="col-due-all"><label>每人應收<input id="col-due-all" type="number" min="0" step="1" inputmode="numeric" placeholder="例如 35000"></label><button type="button" class="quiet" data-col-due-all>套用到全部人</button></div>`
      + `<div class="col-table" role="table" aria-label="每個人的應收與已收"><div class="col-tr col-th" role="row"><span role="columnheader">名字</span><span role="columnheader">應收</span><span role="columnheader">已收</span><span role="columnheader">狀態</span></div>`
      + rows.map(r => `<div class="col-tr" role="row"><span role="cell" class="col-name">${esc(r.name)}</span><span role="cell"><input type="number" min="0" step="1" inputmode="numeric" data-col-due="${esc(r.name)}" value="${r.due || ''}" placeholder="—" aria-label="${esc(r.name)} 應收金額"></span><span role="cell" class="col-num">${r.paid ? ntd(r.paid) : '—'}</span><span role="cell">${status(r)}</span></div>`).join('') + '</div>'
      : '<p class="ed-help">還沒有名單。可以直接在上面輸入名字記一筆，或到「編輯共同行程 → 首頁與總覽」最下面填「旅伴名單」。</p>')
    + `<h3 class="col-h">收款明細（${recs.length} 筆）</h3>`
    + (recs.length ? `<div class="col-recs">${recs.map(r => `<div class="col-rec${r.id === collectEditId ? ' editing' : ''}"><span class="col-date">${mdOf(r.date)}${r.date.slice(0, 4) !== twDate().slice(0, 4) ? `<small>${r.date.slice(0, 4)}</small>` : ''}</span><span class="col-who"><b>${esc(r.name)}</b><small>${esc(r.method)}${r.note ? '・' + esc(r.note) : ''}</small></span><strong class="col-num">${ntd(r.amount)}</strong><span class="col-btns"><button type="button" class="text-btn" data-col-edit="${esc(r.id)}">修改</button><button type="button" class="text-btn danger" data-col-del="${esc(r.id)}" aria-label="刪除 ${esc(r.name)} ${mdOf(r.date)} 的收款">刪除</button></span></div>`).join('')}</div>` : '<p class="muted">還沒有收款紀錄。</p>')
    + `<div class="col-tools"><button type="button" class="quiet" data-col-csv${c.records.length || rows.length ? '' : ' disabled'}>匯出 Excel</button><button type="button" class="quiet" data-col-backup>下載備份</button><label class="quiet col-restore">還原備份<input type="file" accept=".json,application/json" data-col-restore hidden></label></div>`
    + (typeof syncPanel === 'function' ? syncPanel() : '');
}

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function collectCsv(c) {
  const rows = collectRows(c), lines = [['名字', '應收', '已收', '還差'], ...rows.map(r => [r.name, r.due || '', r.paid || '', r.due ? Math.max(0, r.left) : '']),
    [], ['日期', '名字', '金額', '方式', '備註'], ...[...c.records].sort((a, b) => a.date.localeCompare(b.date)).map(r => [r.date, r.name, r.amount, r.method, r.note])];
  return '﻿' + lines.map(l => l.map(csvCell).join(',')).join('\r\n');
}

const collectDlg = $('#collect-dialog');
if (collectDlg) {
  $('#collect-btn')?.addEventListener('click', () => { collectEditId = null; renderCollect(); collectDlg.showModal(); if (typeof openCollectSync === 'function') openCollectSync(); });
  collectDlg.addEventListener('close', () => { if (typeof flushCollectSync === 'function') flushCollectSync(); });
  collectDlg.addEventListener('submit', e => {
    if (e.target.id !== 'collect-form') return;
    e.preventDefault();
    const fd = new FormData(e.target), c = readCollect();
    const rec = { id: collectEditId || uid(), name: String(fd.get('name')).trim(), date: String(fd.get('date')), amount: Math.round(+fd.get('amount')), method: PAY_METHODS.includes(fd.get('method')) ? fd.get('method') : '其他', note: String(fd.get('note') || '').trim() };
    if (!rec.name || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date) || !(rec.amount > 0)) return toast('請填名字、日期和金額');
    c.records = collectEditId ? c.records.map(r => r.id === collectEditId ? rec : r) : [...c.records, rec];
    if (!writeCollect(c)) return;
    toast(`${collectEditId ? '已修改' : '已記下'}：${rec.name} ${ntd(rec.amount)}`);
    collectEditId = null; renderCollect();
  });
  collectDlg.addEventListener('change', e => {
    const name = e.target.dataset.colDue;
    if (name !== undefined) {
      const c = readCollect(), v = e.target.value.trim();
      if (v === '' || +v === 0) delete c.due[name]; else if (+v > 0 && +v <= 1e8) c.due[name] = Math.round(+v); else return toast('應收金額請填數字');
      writeCollect(c);
      // 改完一格按 Tab 跳下一格時，重畫後把游標放回下一格
      setTimeout(() => { const a = document.activeElement?.dataset?.colDue; renderCollect(); if (a !== undefined) collectDlg.querySelector(`[data-col-due="${CSS.escape(a)}"]`)?.focus(); });
    }
    if ('colRestore' in e.target.dataset && e.target.files[0]) {
      e.target.files[0].text().then(t => {
        let c; try { c = JSON.parse(t); } catch {}
        if (!validCollect(c)) return toast('這不是收款紀錄的備份檔');
        if (!confirm(`用備份檔取代目前的收款紀錄？（備份裡有 ${c.records.length} 筆）`)) return;
        c.deleted = [...new Set([...(c.deleted || []), ...readCollect().records.map(r => r.id).filter(id => !c.records.some(r => r.id === id))])];
        if (writeCollect(c)) { collectReplaceNext = true; toast('已還原收款紀錄'); collectEditId = null; renderCollect(); }
      }).finally(() => { e.target.value = ''; });
    }
  });
  collectDlg.addEventListener('click', e => {
    if (e.target === collectDlg || e.target.closest('[data-collect-close]')) return collectDlg.close();
    const ed = e.target.closest('[data-col-edit]');
    if (ed) { collectEditId = ed.dataset.colEdit; renderCollect(); return $('#collect-form').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }
    if (e.target.closest('[data-col-cancel]')) { collectEditId = null; return renderCollect(); }
    const del = e.target.closest('[data-col-del]');
    if (del) {
      const c = readCollect(), r = c.records.find(x => x.id === del.dataset.colDel);
      if (r && confirm(`刪除 ${r.name} ${mdOf(r.date)} 的 ${ntd(r.amount)}？`)) { c.records = c.records.filter(x => x !== r); c.deleted = [...(c.deleted || []), r.id]; if (collectEditId === r.id) collectEditId = null; writeCollect(c); renderCollect(); }
      return;
    }
    if (e.target.closest('[data-col-due-all]')) {
      const v = +$('#col-due-all').value;
      if (!(v > 0)) return toast('先填每人應收多少');
      const c = readCollect(), people = collectPeople(c);
      if (!confirm(`把 ${people.length} 個人的應收都設成 ${ntd(v)}？`)) return;
      people.forEach(n => { c.due[n] = Math.round(v); }); writeCollect(c); return renderCollect();
    }
    if (e.target.closest('[data-col-csv]')) return downloadFile(`收款紀錄-${twDate()}.csv`, collectCsv(readCollect()), 'text/csv;charset=utf-8');
    if (e.target.closest('[data-col-backup]')) return downloadFile(`收款紀錄備份-${twDate()}.json`, JSON.stringify(readCollect(), null, 1), 'application/json');
  });
}

/* ── 加密同步 ──
   雲端檔案 collect.enc.json：{ v, kdf, iter, salt, iv, data }，data 是整份收款紀錄加密後的內容。
   金鑰由同步密碼＋salt 用 PBKDF2-SHA256 算出（31 萬次），只存在這台裝置。
   兩台裝置都改過時會合併：收款明細以每筆的代號合併，刪除過的會記住不再出現；應收金額用比較新的那份。 */
const SYNC_FILE = 'collect.enc.json', SYNC_KEY = 'thai-days-collect-key-v1', SYNC_ITER = 310000;
let syncKey = null, syncSalt = '', syncState = 'idle', syncMsg = '', syncAt = 0, syncTimer = 0, colSyncBusy = false, cloudExists = null, collectReplaceNext = false;
const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveSyncKey(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: SYNC_ITER }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function encryptCollect(c) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, syncKey, new TextEncoder().encode(JSON.stringify(c)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: SYNC_ITER, salt: syncSalt, iv: b64(iv), data: b64(new Uint8Array(ct)) };
}
async function decryptCollect(f, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, key, unb64(f.data));
  const c = JSON.parse(new TextDecoder().decode(pt));
  if (!validCollect(c)) throw Error('format');
  return c;
}
(async () => { try { const k = JSON.parse(localStorage.getItem(SYNC_KEY)); if (k && k.salt && k.key) { syncKey = await crypto.subtle.importKey('raw', unb64(k.key), 'AES-GCM', true, ['encrypt', 'decrypt']); syncSalt = k.salt; syncAt = k.at || 0; } } catch {} })();
async function rememberSyncKey() { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ salt: syncSalt, key: b64(new Uint8Array(await crypto.subtle.exportKey('raw', syncKey))), at: syncAt })); } catch {} }
const syncReady = () => typeof hostToken === 'string' && !!hostToken && !!GH.owner && !!GH.repo;
const syncPath = () => '/contents/' + SYNC_FILE + (GH.branch ? '?ref=' + encodeURIComponent(GH.branch) : '');
async function readCloudCollect() {
  const r = await github(syncPath(), hostToken);
  if (r.status === 404) return null;
  if (!r.ok) throw Error('GitHub ' + r.status);
  const j = await r.json();
  return { file: JSON.parse(fromBase64(j.content)), sha: j.sha };
}
async function writeCloudCollect(c, sha) {
  const body = { message: '更新收款紀錄（加密）', content: toBase64(JSON.stringify(await encryptCollect(c))) };
  if (sha) body.sha = sha; if (GH.branch) body.branch = GH.branch;
  return github('/contents/' + SYNC_FILE, hostToken, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function mergeCollect(a, b) {
  const deleted = [...new Set([...(a.deleted || []), ...(b.deleted || [])])], newer = (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a, older = newer === a ? b : a;
  const byId = new Map(); for (const r of [...older.records, ...newer.records]) byId.set(r.id, r);
  const order = [...a.records, ...b.records].map(r => r.id).filter((id, i, arr) => arr.indexOf(id) === i);
  return { version: 1, due: { ...newer.due }, records: order.filter(id => !deleted.includes(id)).map(id => byId.get(id)), deleted, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}
const sameCollect = (a, b) => JSON.stringify({ d: a.due, r: a.records, x: [...(a.deleted || [])].sort() }) === JSON.stringify({ d: b.due, r: b.records, x: [...(b.deleted || [])].sort() });
function syncStatus(state, msg) { syncState = state; syncMsg = msg || ''; const el = $('#col-sync-status'); if (el) el.innerHTML = syncStatusText(); }
function syncStatusText() {
  const t = syncAt ? new Date(syncAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return syncState === 'busy' ? '同步中…' : syncState === 'error' ? `<span class="col-sync-err">${esc(syncMsg)}</span>` : t ? `最後同步：${t}（台灣時間）` : '';
}
async function syncCollect(opts = {}) {
  if (!syncKey || !syncReady()) return;
  if (colSyncBusy) { scheduleCollectSync(); return; }
  colSyncBusy = true; clearTimeout(syncTimer); syncStatus('busy');
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const local = readCollect(), cloud = await readCloudCollect();
      cloudExists = !!cloud;
      const replace = opts.replace || collectReplaceNext;
      let remote = null;
      if (cloud && !replace) {
        try { remote = await decryptCollect(cloud.file, syncKey); } catch {
          // 別台裝置換了同步密碼：這台的舊金鑰作廢，改顯示輸入密碼的欄位（這台的紀錄保留，輸入新密碼後會合併）
          syncKey = null; syncSalt = ''; try { localStorage.removeItem(SYNC_KEY); } catch {}
          cloudExists = true; syncStatus('error', '同步密碼在別台裝置換過了，請輸入新的同步密碼。'); refreshSyncPanel();
          return;
        }
      }
      const merged = remote && !replace ? mergeCollect(local, remote) : local;
      if (!sameCollect(merged, local)) { writeCollect(merged, true); const typing = collectDlg.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName); if (collectDlg.open && !typing && !collectEditId) renderCollect(); }
      if (!remote || !sameCollect(merged, remote)) {
        const w = await writeCloudCollect(merged, cloud?.sha);
        if (w.status === 409 || w.status === 422) continue; // 別台裝置剛好也在存，重新合併一次
        if (!w.ok) throw Error(w.status === 401 || w.status === 403 ? '主辦人權杖沒有寫入權限，請重新登入。' : `同步失敗（GitHub ${w.status}），稍後會再試。`);
      }
      collectReplaceNext = false; syncAt = Date.now(); await rememberSyncKey(); syncStatus('ok');
      return;
    }
    throw Error('同步失敗，稍後會再試。');
  } catch (e) {
    syncStatus('error', e.message || '同步失敗，請檢查網路。');
  } finally { colSyncBusy = false; }
}
function scheduleCollectSync() { if (!syncKey) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncCollect, 5000); }
function flushCollectSync() { if (syncKey && syncTimer) { clearTimeout(syncTimer); syncTimer = 0; syncCollect(); } }
async function openCollectSync() {
  if (!syncReady()) return;
  if (syncKey) return syncCollect();
  try { cloudExists = !!(await readCloudCollect()); } catch { cloudExists = null; }
  if (collectDlg.open) refreshSyncPanel();
}
function refreshSyncPanel() { const el = $('#col-sync'); if (el) el.outerHTML = syncPanel(); }
function syncPanel() {
  const head = '<h3 class="col-h">雲端同步（加密）</h3>';
  if (!syncReady()) return `<div id="col-sync" class="col-sync">${head}<p class="muted">需要用主辦人登入才能同步。目前紀錄只存在這台裝置，換手機前請先「下載備份」。</p></div>`;
  if (syncKey) return `<div id="col-sync" class="col-sync on">${head}<p>🔒 已開啟。這台裝置的修改會自動加密後同步；在別台裝置用主辦人登入、輸入同一組同步密碼，就能看到同一份紀錄。</p><p class="muted" id="col-sync-status">${syncStatusText()}</p><div class="col-tools"><button type="button" class="quiet" data-sync-now>立即同步</button><button type="button" class="quiet" data-sync-change>換同步密碼</button><button type="button" class="quiet" data-sync-off>這台停止同步</button></div><form id="col-sync-form" class="col-sync-form" data-mode="change" hidden><label>新的同步密碼（至少 8 個字）<input name="pw" type="password" minlength="8" maxlength="200" autocomplete="new-password" required></label><label>再輸入一次<input name="pw2" type="password" minlength="8" maxlength="200" autocomplete="new-password" required></label><button class="primary">改用新密碼</button><p class="muted">別台裝置之後要輸入新密碼。</p></form></div>`;
  const unlock = cloudExists === true;
  return `<div id="col-sync" class="col-sync">${head}<p>${unlock ? '雲端已經有加密的收款紀錄。輸入同步密碼，就會和這台裝置的紀錄合併。' : '設一組同步密碼，紀錄會加密後存到網站的儲存庫。網站雖然是公開的，但沒有密碼的人只看得到亂碼。之後在別台裝置用主辦人登入、輸入同一組密碼就能看到。'}</p><form id="col-sync-form" class="col-sync-form" data-mode="${unlock ? 'unlock' : 'setup'}"><label>同步密碼${unlock ? '' : '（至少 8 個字，請記好，忘記就打不開雲端的紀錄）'}<input name="pw" type="password" minlength="8" maxlength="200" autocomplete="${unlock ? 'current-password' : 'new-password'}" required></label>${unlock ? '' : '<label>再輸入一次<input name="pw2" type="password" minlength="8" maxlength="200" autocomplete="new-password" required></label>'}<button class="primary">${unlock ? '解鎖並同步' : '開始加密同步'}</button></form><p class="muted" id="col-sync-status">${syncStatusText()}</p></div>`;
}
if (collectDlg) {
  collectDlg.addEventListener('submit', async e => {
    if (e.target.id !== 'col-sync-form') return;
    e.preventDefault();
    const f = e.target, mode = f.dataset.mode, pw = f.elements.pw.value, btn = f.querySelector('button');
    if (pw.length < 8) return toast('同步密碼至少 8 個字');
    if (f.elements.pw2 && pw !== f.elements.pw2.value) return toast('兩次輸入的密碼不一樣');
    btn.disabled = true; syncStatus('busy');
    try {
      const cloud = await readCloudCollect();
      if (mode === 'unlock' && cloud) {
        const key = await deriveSyncKey(pw, cloud.file.salt);
        try { await decryptCollect(cloud.file, key); } catch { btn.disabled = false; return syncStatus('error', '密碼不對，請再試一次。'); }
        syncKey = key; syncSalt = cloud.file.salt;
      } else {
        if (mode === 'setup' && cloud) { cloudExists = true; btn.disabled = false; syncStatus('idle'); refreshSyncPanel(); return toast('雲端已經有加密紀錄了，請輸入原本的同步密碼'); }
        // 新設定或換密碼：先用舊金鑰把雲端的合併進來，再換新的 salt 和金鑰重新加密
        if (mode === 'change' && cloud && syncKey) { try { writeCollect(mergeCollect(readCollect(), await decryptCollect(cloud.file, syncKey)), true); } catch {} }
        syncSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
        syncKey = await deriveSyncKey(pw, syncSalt);
        collectReplaceNext = true;
      }
      await rememberSyncKey();
      await syncCollect();
      toast(syncState === 'ok' ? (mode === 'unlock' ? '已解鎖，紀錄已合併' : '已加密同步') : '同步沒有成功，稍後會再試');
      renderCollect();
    } catch (err) { btn.disabled = false; syncStatus('error', '連不到 GitHub，請檢查網路後再試。'); }
  });
  collectDlg.addEventListener('click', e => {
    if (e.target.closest('[data-sync-now]')) return syncCollect();
    if (e.target.closest('[data-sync-change]')) { const f = $('#col-sync-form'); f.hidden = !f.hidden; if (!f.hidden) f.elements.pw.focus(); return; }
    if (e.target.closest('[data-sync-off]') && confirm('這台裝置停止同步？（這台和雲端的紀錄都會保留，之後輸入密碼可以再開）')) {
      syncKey = null; syncSalt = ''; syncAt = 0; clearTimeout(syncTimer); try { localStorage.removeItem(SYNC_KEY); } catch {} cloudExists = true; renderCollect();
    }
  });
  window.addEventListener('pagehide', flushCollectSync);
}
