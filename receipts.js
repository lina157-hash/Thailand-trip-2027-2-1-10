/* 收據／發票照片：記帳時拍照或選一張照片，縮小後存到主辦人的 Firebase（和「登入同步」同一個專案），旅伴登入後在「大家的憑證」看得到。
   每張收據存兩份文件，列表只讀小圖，點開才讀大圖，省流量：
     receipts/{rid}    = { uid, by, name, amount, currency, date, cat, thumb, shared, at }
     receiptImgs/{rid} = { uid, shared, img }
   shared 為 false 的收據只有上傳的人自己看得到。Firestore 規則：登入的人能讀 shared 的收據或自己的收據，只能新增、修改、刪除自己的。
   花費本身仍是個人資料，只在 state.expenses 裡記下 rid，旅伴看到的是收據上附的項目、金額、日期與上傳者名字。
   上傳要先用 Google 登入（gsync.js）；沒有設定 Firebase 時整個功能會隱藏。 */
const RECEIPT_MAX = 1400, RECEIPT_THUMB = 240, RECEIPT_LIMIT = 800000;
let receiptDraft = null; // 表單裡的照片：null＝沒有；{ mode: 'keep' | 'new' | 'remove', img, thumb, shared }
const receiptMap = new Map(); // 從雲端讀到的收據（rid → 資料），自己的和旅伴分享的
let receiptUser = null, receiptMineOnly = false, receiptPending = 0, receiptErr = '';

(() => {
  const g = window.gsync;
  if (!g) return;
  $('#receipt-field').hidden = false; $('#receipts-panel').hidden = false;
  let unsubs = [];
  g.onUser(async u => {
    unsubs.forEach(f => f()); unsubs = []; receiptMap.clear(); receiptUser = u; receiptErr = '';
    renderReceiptPick(); renderReceipts();
    if (!u) return;
    const { db, F } = await g.sdk(), col = F.collection(db, 'receipts');
    const seen = { shared: new Set(), mine: new Set() };
    const listen = (which, q) => F.onSnapshot(q, snap => {
      const now = new Set(snap.docs.map(d => d.id));
      // 不再出現在這個查詢的收據（被刪除或改成不分享），另一個查詢也沒有才從畫面拿掉
      for (const id of seen[which]) if (!now.has(id) && !seen[which === 'mine' ? 'shared' : 'mine'].has(id)) receiptMap.delete(id);
      seen[which] = now;
      snap.docs.forEach(d => receiptMap.set(d.id, { id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
      receiptErr = ''; renderReceipts(); renderReceiptPick();
    }, e => { console.warn('receipts listen', e); receiptErr = e.code === 'permission-denied' ? '主辦人還沒在 Firebase 貼上收據的規則，暫時看不到收據。' : '暫時讀不到收據，請檢查網路。'; renderReceipts(); });
    unsubs = [listen('shared', F.query(col, F.where('shared', '==', true))), listen('mine', F.query(col, F.where('uid', '==', u.uid)))];
  });
  g.sdk().catch(() => { receiptErr = '載入不了 Google 登入（可能沒有網路），暫時不能上傳或查看收據。'; renderReceipts(); });
  addEventListener('beforeunload', e => { if (receiptPending) { e.preventDefault(); e.returnValue = ''; } });
})();

// 照片縮小成 JPEG：長邊不超過 max，太大就再降畫質或尺寸，確保放得進一份 Firestore 文件
function receiptShrink(file, max, quality, limit) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let size = max, q = quality, out = '';
      for (let i = 0; i < 8; i++) {
        const k = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length <= limit) return ok(out);
        if (q > 0.5) q -= 0.1; else size = Math.round(size * 0.8);
      }
      ok(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('讀不到這張照片')); };
    img.src = url;
  });
}

function receiptName() {
  let n = '';
  try { n = localStorage.getItem('thai-days-name-v1') || localStorage.getItem('thai-days-split-me-v1') || ''; } catch {}
  if (n) return n;
  n = (prompt('請輸入你的名字（旅伴看收據時會看到是誰上傳的）') || '').trim().slice(0, 30);
  if (n) { try { localStorage.setItem('thai-days-name-v1', n); } catch {} if (typeof myName !== 'undefined') myName = n; }
  return n || '旅伴';
}

// ── 記帳表單裡的照片區 ──
function renderReceiptPick() {
  const box = $('#receipt-pick'); if (!box) return;
  const d = receiptDraft, show = d && d.mode !== 'remove';
  if (!show) {
    box.innerHTML = `<button type="button" class="quiet" data-receipt-add>📷 拍照或選照片</button><small class="muted">${receiptUser ? '照片會縮小後上傳；卡號等資訊可以先遮住再拍。' : '要先「☁️ 登入同步」才能附上收據。'}</small>`;
    return;
  }
  const thumb = d.thumb || receiptMap.get(d.rid)?.thumb || '';
  box.innerHTML = `<div class="receipt-picked">${thumb ? `<img src="${thumb}" alt="收據小圖">` : '<span class="receipt-noimg">🧾</span>'}<div><label class="receipt-share"><input type="checkbox" data-receipt-shared${d.shared ? ' checked' : ''}> 讓旅伴看到這張收據</label><div class="receipt-acts"><button type="button" class="text-btn" data-receipt-add>換一張</button><button type="button" class="text-btn danger" data-receipt-remove>移除照片</button></div></div></div>`;
}
function receiptReset() { receiptDraft = null; const f = $('#receipt-file'); if (f) f.value = ''; renderReceiptPick(); }
function receiptOnEdit(x) { receiptDraft = x.rid ? { mode: 'keep', rid: x.rid, shared: receiptMap.get(x.rid)?.shared !== false } : null; renderReceiptPick(); }

document.addEventListener('click', e => {
  if (e.target.closest('[data-receipt-add]')) {
    if (!window.gsync) return;
    if (!receiptUser) { toast('先用 Google 登入，才能上傳收據'); return gsync.open(); }
    $('#receipt-file').click();
  }
  if (e.target.closest('[data-receipt-remove]')) { receiptDraft = receiptDraft?.rid ? { ...receiptDraft, mode: 'remove' } : null; $('#receipt-file').value = ''; renderReceiptPick(); }
  const view = e.target.closest('[data-receipt]'); if (view) openReceipt(view.dataset.receipt);
  if (e.target.closest('[data-receipt-filter]')) { receiptMineOnly = e.target.closest('[data-receipt-filter]').dataset.receiptFilter === 'mine'; renderReceipts(); }
  if (e.target.closest('[data-receipt-login]')) gsync.open();
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-receipt-shared]') && receiptDraft) receiptDraft.shared = e.target.checked;
  if (e.target.id !== 'receipt-file' || !e.target.files[0]) return;
  const file = e.target.files[0];
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) return toast('請選一張照片');
  const box = $('#receipt-pick'); box.innerHTML = '<p class="muted">照片處理中…</p>';
  Promise.all([receiptShrink(file, RECEIPT_MAX, 0.75, RECEIPT_LIMIT), receiptShrink(file, RECEIPT_THUMB, 0.6, 40000)])
    .then(([img, thumb]) => { receiptDraft = { mode: 'new', rid: receiptDraft?.rid, img, thumb, shared: receiptDraft ? receiptDraft.shared : true }; renderReceiptPick(); })
    .catch(err => { toast(err.message + '，請換一張試試'); renderReceiptPick(); });
});

// 按下「新增支出／儲存修改」時由 app.js 呼叫：決定這筆花費的 rid，並在背景上傳或更新收據
function receiptOnSave(entry, prev) {
  const d = receiptDraft, oldRid = prev?.rid;
  if (!d) { if (oldRid) entry.rid = oldRid; if (oldRid) receiptWrite('meta', oldRid, entry); return; }
  if (d.mode === 'remove') { if (oldRid) receiptWrite('delete', oldRid); return; }
  const rid = oldRid || d.rid || uid().replace(/-/g, '');
  entry.rid = rid;
  if (d.mode === 'new') receiptWrite('new', rid, entry, d);
  else receiptWrite('meta', rid, entry, d);
}
function receiptOnDelete(x) {
  if (receiptUser) receiptWrite('delete', x.rid);
  else toast('收據還在雲端：登入後到「大家的憑證」點開這張收據就能刪除');
}

async function receiptWrite(kind, rid, entry, d) {
  const g = window.gsync; if (!g) return;
  if (!receiptUser) { if (kind !== 'meta') toast('要先用 Google 登入，收據才能上傳'); return; }
  const { db, F } = await g.sdk(), me = receiptUser.uid, metaRef = F.doc(db, 'receipts', rid), imgRef = F.doc(db, 'receiptImgs', rid), old = receiptMap.get(rid);
  if (old && old.uid !== me) return;
  const info = entry && { name: entry.name, amount: entry.amount, currency: entry.currency, date: entry.date, cat: entry.cat };
  const batch = F.writeBatch(db);
  if (kind === 'delete') { batch.delete(metaRef); batch.delete(imgRef); }
  else if (kind === 'new') {
    batch.set(imgRef, { uid: me, shared: d.shared, img: d.img });
    batch.set(metaRef, { uid: me, by: receiptName(), ...info, thumb: d.thumb, shared: d.shared, at: F.serverTimestamp() });
  } else {
    // 只改了項目、金額或分享設定：沒有這張收據的資料就不寫
    if (!old) return;
    const shared = d ? d.shared : old.shared !== false;
    if (shared === (old.shared !== false) && Object.entries(info).every(([k, v]) => old[k] === v)) return;
    batch.update(metaRef, { ...info, shared });
    if (shared !== (old.shared !== false)) batch.update(imgRef, { shared });
  }
  receiptPending++;
  if (kind === 'new') toast('收據上傳中，請保持網路連線…');
  try { await batch.commit(); if (kind === 'new') toast('收據已上傳'); if (kind === 'delete') toast('收據已刪除'); }
  catch (e) { console.warn('receipt write', e); if (kind === 'delete' && !old) return; toast(e.code === 'permission-denied' ? '收據上傳被拒絕：請主辦人確認 Firebase 規則已更新' : '收據沒有上傳成功，請稍後編輯這筆花費再附一次'); }
  finally { receiptPending--; }
}

// ── 「大家的憑證」列表 ──
function renderReceipts() {
  const box = $('#receipts-view'); if (!box) return;
  if (!receiptUser) {
    box.innerHTML = receiptErr ? `<p class="muted">${esc(receiptErr)}</p>` : '<div class="empty">用 Google 登入後，就能看到旅伴上傳的收據和發票。<p><button type="button" class="quiet" data-receipt-login>☁️ 用 Google 登入</button></p></div>';
    return;
  }
  const me = receiptUser.uid, all = [...receiptMap.values()].filter(r => r.shared !== false || r.uid === me),
    list = all.filter(r => !receiptMineOnly || r.uid === me).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.at?.seconds || 0) - (b.at?.seconds || 0));
  const chips = `<div class="receipt-filter" role="group" aria-label="篩選收據"><button type="button" class="chip${receiptMineOnly ? '' : ' active'}" data-receipt-filter="all" aria-pressed="${!receiptMineOnly}">全部 ${all.length}</button><button type="button" class="chip${receiptMineOnly ? ' active' : ''}" data-receipt-filter="mine" aria-pressed="${receiptMineOnly}">只看我的 ${all.filter(r => r.uid === me).length}</button></div>`;
  if (receiptErr) { box.innerHTML = `<p class="muted">${esc(receiptErr)}</p>`; return; }
  if (!list.length) { box.innerHTML = (all.length ? chips : '') + `<div class="empty">${receiptMineOnly ? '你還沒有上傳收據。' : '還沒有人上傳收據。'}<p>在上面「新增一筆花費」按「📷 拍照或選照片」，就能附上收據。</p></div>`; return; }
  let last = '';
  box.innerHTML = chips + '<div class="receipt-grid">' + list.map(r => {
    const d = +String(r.date || '').slice(8), head = r.date !== last && d ? `<div class="exp-day receipt-day" data-dow="${dowOf(d)}">2/${d}（週${weekdays[d - 1]}）</div>` : ''; last = r.date;
    const cur = r.currency === 'TWD' ? 'TWD' : 'THB';
    return head + `<button type="button" class="receipt-card" data-receipt="${esc(r.id)}"><img src="${r.thumb || ''}" alt="" loading="lazy"><span class="receipt-meta"><b>${esc(r.name || '收據')}</b><span>${cash(+r.amount || 0, cur)}</span><small>${esc(r.by || '旅伴')}${r.uid === me ? '（我）' : ''}${r.shared === false ? '・只有我看得到' : ''}${r.pending ? '・上傳中' : ''}</small></span></button>`;
  }).join('') + '</div>';
}

// ── 點開看大圖 ──
const receiptDlg = document.createElement('dialog');
receiptDlg.className = 'receipt-dialog'; receiptDlg.setAttribute('aria-label', '收據照片');
document.body.appendChild(receiptDlg);
let receiptBlob = '';
async function openReceipt(rid) {
  const r = receiptMap.get(rid), me = receiptUser?.uid;
  if (!receiptUser) { toast('先用 Google 登入，才能看收據'); return gsync?.open(); }
  const own = state.expenses.find(x => x.rid === rid);
  if (!r) return toast(own ? '這張收據還沒上傳成功，請編輯這筆花費再附一次照片' : '找不到這張收據，可能已經被刪除');
  const cur = r.currency === 'TWD' ? 'TWD' : 'THB', d = +String(r.date || '').slice(8);
  receiptDlg.innerHTML = `<div class="section-top"><div><h2>${esc(r.name || '收據')}</h2><p class="muted">${cash(+r.amount || 0, cur)}・2/${d}・${esc(r.by || '旅伴')} 上傳${r.shared === false ? '・只有你看得到' : ''}</p></div><button type="button" class="quiet" data-receipt-close>關閉</button></div><div class="receipt-big"><img src="${r.thumb || ''}" alt="收據照片" class="loading"></div><p class="muted receipt-tip">點照片可以放大；手機也可以用兩指放大。</p><div class="form-actions"><a class="quiet btn-link" data-receipt-dl hidden download="收據-${esc(r.name || rid)}.jpg">下載照片</a>${r.uid === me ? '<button type="button" class="quiet danger" data-receipt-del>刪除這張收據</button>' : ''}</div>`;
  receiptDlg.dataset.rid = rid; receiptDlg.showModal();
  try {
    const { db, F } = await gsync.sdk(), snap = await F.getDoc(F.doc(db, 'receiptImgs', rid));
    if (receiptDlg.dataset.rid !== rid) return;
    const img = receiptDlg.querySelector('.receipt-big img');
    if (!snap.exists()) { img.classList.remove('loading'); return toast('大圖還在上傳，先顯示小圖'); }
    img.src = snap.data().img; img.classList.remove('loading');
    if (receiptBlob) URL.revokeObjectURL(receiptBlob);
    receiptBlob = URL.createObjectURL(await (await fetch(snap.data().img)).blob());
    const a = receiptDlg.querySelector('[data-receipt-dl]'); a.href = receiptBlob; a.hidden = false;
  } catch (e) { console.warn('receipt open', e); receiptDlg.querySelector('.receipt-big img')?.classList.remove('loading'); toast('讀不到大圖，請檢查網路'); }
}
receiptDlg.addEventListener('click', async e => {
  if (e.target === receiptDlg || e.target.closest('[data-receipt-close]')) return receiptDlg.close();
  if (e.target.closest('.receipt-big img')) e.target.closest('.receipt-big').classList.toggle('zoom');
  if (e.target.closest('[data-receipt-del]')) {
    const rid = receiptDlg.dataset.rid;
    if (!confirm('刪除這張收據？旅伴也會看不到。（花費紀錄會保留）')) return;
    receiptDlg.close();
    const x = state.expenses.find(x => x.rid === rid);
    if (x) { delete x.rid; save(); renderBudget(); }
    await receiptWrite('delete', rid);
  }
});
renderReceiptPick(); renderReceipts();
