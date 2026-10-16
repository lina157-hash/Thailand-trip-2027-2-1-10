/* 收款紀錄（主辦人登入後右上角出現「收款」）：記下出發前向每位旅伴收了多少旅費、哪天收的、怎麼付的。
 * 只存在主辦人這台裝置的瀏覽器裡，不會上傳到網站或 GitHub（網站資料是公開的，金錢紀錄不放那裡），旅伴完全看不到。
 * 換手機或清除瀏覽器資料前，用「下載備份」存一份，新裝置再「還原備份」；「匯出 Excel」可以留檔或列印。 */
const COLLECT_KEY = 'thai-days-collect-v1';
const PAY_METHODS = ['轉帳', '現金', 'LINE Pay', '其他'];
let collectEditId = null;

const validCollect = c => !!c && typeof c === 'object' && c.version === 1
  && c.due && typeof c.due === 'object' && !Array.isArray(c.due)
  && Object.entries(c.due).every(([k, v]) => typeof k === 'string' && k.length <= 40 && Number.isFinite(v) && v >= 0 && v <= 1e8)
  && Array.isArray(c.records) && c.records.every(r => r && typeof r.id === 'string' && typeof r.name === 'string' && r.name.trim() && r.name.length <= 40
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.amount) && r.amount > 0 && r.amount <= 1e8
    && typeof r.method === 'string' && r.method.length <= 20 && typeof r.note === 'string' && r.note.length <= 200);
function readCollect() { try { const c = JSON.parse(localStorage.getItem(COLLECT_KEY)); if (validCollect(c)) return c; } catch {} return { version: 1, due: {}, records: [] }; }
function writeCollect(c) { try { localStorage.setItem(COLLECT_KEY, JSON.stringify(c)); return true; } catch { toast('儲存失敗，請先下載備份'); return false; } }

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
    + `<p class="muted col-privacy">🔒 這份紀錄只存在這台裝置，不會上傳到網站，旅伴看不到。換手機或清除瀏覽器資料前，請先「下載備份」。</p>`;
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
  $('#collect-btn')?.addEventListener('click', () => { collectEditId = null; renderCollect(); collectDlg.showModal(); });
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
        if (writeCollect(c)) { toast('已還原收款紀錄'); collectEditId = null; renderCollect(); }
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
      if (r && confirm(`刪除 ${r.name} ${mdOf(r.date)} 的 ${ntd(r.amount)}？`)) { c.records = c.records.filter(x => x !== r); if (collectEditId === r.id) collectEditId = null; writeCollect(c); renderCollect(); }
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
