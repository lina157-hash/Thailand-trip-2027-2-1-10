/* 收據／發票照片：記帳時拍照或選一張照片，縮小後存到主辦人的 Firebase（和「登入同步」同一個專案），團員在「大家的憑證」看得到。
   每張收據存兩份文件，列表只讀小圖，點開才讀大圖，省流量：
     receipts/{rid}    = { uid, by, name, amount, currency, date, cat, thumb, shared, at }
     receiptImgs/{rid} = { uid, shared, img }
   團員審核：用 Google 登入只代表「有帳號」，還要主辦人同意才算團員。
     requests/{uid} = { name, email, at }  旅伴按「申請加入」時寫入，只有自己和主辦人讀得到
     members/{uid}  = { name, email, at }  主辦人按「同意」後建立，只有主辦人能新增或移除
     accounts/{uid} = { email, gname, first, last }  每次登入時記下，只有主辦人與管理者讀得到，用來列出「所有登入過的帳號」
     admins/{email} = { at }  管理者名單，只有主辦人能新增或移除
   主辦人的 Gmail 只寫在 Firestore 規則裡（不放在網站程式裡）。網站用「讀不讀得到申請名單」判斷是不是主辦人或管理者，
   用「讀不讀得到 owner/check」判斷是不是主辦人本人（這份文件不存在也沒關係，只看有沒有權限）。
   Firestore 規則：團員能讀 shared 的收據或自己的收據，只能新增、修改自己的；主辦人可以刪除任何一張。
   花費本身仍是個人資料，只在 state.expenses 裡記下 rid，團員看到的是收據上附的項目、金額、日期與上傳者名字。
   沒有設定 Firebase 時整個功能會隱藏。 */
const RECEIPT_MAX = 1400, RECEIPT_THUMB = 240, RECEIPT_LIMIT = 800000;
let receiptDraft = null; // 表單裡的照片：null＝沒有；{ mode: 'keep' | 'new' | 'remove', img, thumb, shared }
const receiptMap = new Map(); // 從雲端讀到的收據（rid → 資料），自己的和旅伴分享的
let receiptUser = null, receiptMineOnly = false, receiptPending = 0, receiptErr = '';
// 身分：'' 確認中、guest 還沒申請、pending 等主辦人同意、member 團員、admin 主辦人
let receiptRole = '', receiptMe = null, receiptReq = null, receiptRequests = [], receiptMembers = [], receiptAccounts = [], receiptAdmins = [], receiptOwner = false;
const receiptOpen = {}; // 審核區摺疊清單的開合，重畫時保留
const receiptOk = () => receiptRole === 'member' || receiptRole === 'admin';

(() => {
  const g = window.gsync;
  if (!g) return;
  $('#receipt-field').hidden = false; $('#receipts-panel').hidden = false;
  let unsubs = [], dataUnsubs = [];
  const stopReceipts = () => { dataUnsubs.forEach(f => f()); dataUnsubs = []; receiptMap.clear(); };
  const fail = what => e => { console.warn('receipts ' + what, e); receiptErr = e.code === 'permission-denied' ? '主辦人還沒在 Firebase 貼上團員審核的規則，暫時看不到收據。' : '暫時讀不到收據，請檢查網路。'; renderReceipts(); };
  function startReceipts(F, db, u) {
    if (dataUnsubs.length) return;
    const col = F.collection(db, 'receipts'), seen = { shared: new Set(), mine: new Set() };
    const listen = (which, q) => F.onSnapshot(q, snap => {
      const now = new Set(snap.docs.map(d => d.id));
      // 不再出現在這個查詢的收據（被刪除或改成不分享），另一個查詢也沒有才從畫面拿掉
      for (const id of seen[which]) if (!now.has(id) && !seen[which === 'mine' ? 'shared' : 'mine'].has(id)) receiptMap.delete(id);
      seen[which] = now;
      snap.docs.forEach(d => receiptMap.set(d.id, { id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
      receiptErr = ''; renderReceipts(); renderReceiptPick();
    }, async e => {
      // 被主辦人移出團員時也會讀不到：停掉收據，等團員狀態更新；還是團員卻讀不到才是規則或網路的問題
      stopReceipts(); renderReceipts();
      let still = true; try { still = (await F.getDoc(F.doc(db, 'members', u.uid))).exists() || receiptRole === 'admin'; } catch {}
      if (still && receiptUser === u) fail('listen')(e);
    });
    dataUnsubs.push(listen('shared', F.query(col, F.where('shared', '==', true))), listen('mine', F.query(col, F.where('uid', '==', u.uid))));
  }
  g.onUser(async u => {
    unsubs.forEach(f => f()); unsubs = []; stopReceipts();
    receiptUser = u; receiptErr = ''; receiptRole = ''; receiptMe = receiptReq = null; receiptRequests = []; receiptMembers = []; receiptAccounts = []; receiptAdmins = []; receiptOwner = false;
    renderReceiptPick(); renderReceipts();
    if (!u) return;
    const { db, F } = await g.sdk();
    if (receiptUser !== u) return;
    // 記下這個帳號登入過，主辦人才看得到有誰登入
    const accRef = F.doc(db, 'accounts', u.uid);
    F.getDoc(accRef).then(a => F.setDoc(accRef, { email: u.email || '', gname: u.displayName || '', last: F.serverTimestamp(), ...(a.exists() ? {} : { first: F.serverTimestamp() }) }, { merge: true })).catch(e => console.warn('account', e));
    // 主辦人與管理者才讀得到整份申請名單
    let admin = false;
    try { await F.getDocs(F.query(F.collection(db, 'requests'), F.limit(1))); admin = true; } catch {}
    if (receiptUser !== u) return;
    if (admin) {
      receiptRole = 'admin'; startReceipts(F, db, u);
      try { await F.getDoc(F.doc(db, 'owner', 'check')); receiptOwner = true; } catch {}
      // 讓管理者在帳號名單上認得主辦人（規則只允許主辦人本人寫 role: 'owner'）
      if (receiptOwner) F.setDoc(accRef, { role: 'owner' }, { merge: true }).catch(e => console.warn('owner tag', e));
      const list = (c, set) => F.onSnapshot(F.collection(db, c), snap => { set(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'))); renderReceipts(); }, fail(c));
      unsubs.push(list('requests', v => { receiptRequests = v; }), list('members', v => { receiptMembers = v; receiptMe = v.find(m => m.id === u.uid) || null; }),
        list('accounts', v => { receiptAccounts = v; }), list('admins', v => { receiptAdmins = v; }));
      renderReceipts(); renderReceiptPick();
      return;
    }
    // 一般旅伴：看自己有沒有被同意、有沒有送出申請；主辦人一按同意，畫面會自己更新
    let got = { m: false, r: false };
    const decide = () => {
      if (!got.m || !got.r) return;
      receiptRole = receiptMe ? 'member' : receiptReq ? 'pending' : 'guest';
      if (receiptOk()) startReceipts(F, db, u); else stopReceipts();
      renderReceipts(); renderReceiptPick();
    };
    unsubs.push(
      F.onSnapshot(F.doc(db, 'members', u.uid), snap => { receiptMe = snap.exists() ? snap.data() : null; got.m = true; decide(); }, fail('member')),
      F.onSnapshot(F.doc(db, 'requests', u.uid), snap => { receiptReq = snap.exists() ? snap.data() : null; got.r = true; decide(); }, fail('request')));
  });
  g.sdk().catch(() => { receiptErr = '載入不了 Google 登入（可能沒有網路），暫時不能上傳或查看收據。'; renderReceipts(); });
  addEventListener('beforeunload', e => { if (receiptPending) { e.preventDefault(); e.returnValue = ''; } });
})();

// 申請加入、同意、拒絕、移除
async function receiptMembership(kind, id) {
  const { db, F } = await gsync.sdk(), u = receiptUser; if (!u) return;
  try {
    if (kind === 'apply') {
      const name = receiptName(true); if (!name) return;
      await F.setDoc(F.doc(db, 'requests', u.uid), { name, email: u.email || '', at: F.serverTimestamp() });
      toast('已送出申請，等主辦人同意');
    } else if (kind === 'cancel') { await F.deleteDoc(F.doc(db, 'requests', u.uid)); toast('已取消申請'); }
    else if (kind === 'approve') {
      const r = receiptRequests.find(x => x.id === id); if (!r) return;
      const b = F.writeBatch(db);
      b.set(F.doc(db, 'members', id), { name: r.name || '旅伴', email: r.email || '', at: F.serverTimestamp() });
      b.delete(F.doc(db, 'requests', id));
      await b.commit(); toast(`已同意 ${r.name || '旅伴'} 加入`);
    } else if (kind === 'reject') {
      const r = receiptRequests.find(x => x.id === id); if (!confirm(`拒絕 ${r?.name || '這個人'} 的申請？`)) return;
      await F.deleteDoc(F.doc(db, 'requests', id)); toast('已拒絕');
    } else if (kind === 'make') {
      const a = receiptAccounts.find(x => x.id === id), r = receiptRequests.find(x => x.id === id); if (!a && !r) return;
      const name = (prompt('團員名字（旅伴看收據時會看到）', r?.name || a?.gname || (a?.email || '').split('@')[0]) || '').trim().slice(0, 30); if (!name) return;
      const b = F.writeBatch(db);
      b.set(F.doc(db, 'members', id), { name, email: a?.email || r?.email || '', at: F.serverTimestamp() });
      if (r) b.delete(F.doc(db, 'requests', id));
      await b.commit(); toast(`已把 ${name} 設為團員`);
    } else if (kind === 'addAdmin') {
      const mail = (prompt('新管理者的 Gmail（對方用這個帳號登入後，就能審核團員）') || '').trim().toLowerCase();
      if (!mail) return;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return toast('Gmail 格式不對，請再輸入一次');
      await F.setDoc(F.doc(db, 'admins', mail), { at: F.serverTimestamp() }); toast(`已新增管理者 ${mail}，對方重新整理網頁後生效`);
    } else if (kind === 'delAdmin') {
      if (!confirm(`取消 ${id} 的管理者身分？`)) return;
      await F.deleteDoc(F.doc(db, 'admins', id)); toast('已取消管理者');
    } else if (kind === 'remove') {
      const m = receiptMembers.find(x => x.id === id); if (!confirm(`把 ${m?.name || '這個人'} 移出團員？移除後對方就看不到收據。`)) return;
      await F.deleteDoc(F.doc(db, 'members', id)); toast('已移出團員');
    }
  } catch (e) { console.warn('membership', e); toast(e.code === 'permission-denied' ? '沒有權限：請主辦人確認 Firebase 規則已更新' : '沒有成功，請檢查網路再試一次'); }
}

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

function receiptName(ask) {
  if (!ask && receiptMe?.name) return receiptMe.name;
  let n = '';
  try { n = localStorage.getItem('thai-days-name-v1') || localStorage.getItem('thai-days-split-me-v1') || ''; } catch {}
  if (n && !ask) return n;
  const v = prompt(ask ? '請輸入你的名字（主辦人審核時會看到，請用大家認得的名字）' : '請輸入你的名字（旅伴看收據時會看到是誰上傳的）', n);
  if (v === null) return ask ? '' : n || '旅伴';
  n = v.trim().slice(0, 30);
  if (n) { try { localStorage.setItem('thai-days-name-v1', n); } catch {} if (typeof myName !== 'undefined') myName = n; }
  return n || (ask ? '' : '旅伴');
}

// ── 記帳表單裡的照片區 ──
function renderReceiptPick() {
  const box = $('#receipt-pick'); if (!box) return;
  const d = receiptDraft, show = d && d.mode !== 'remove';
  if (!show) {
    const tip = !receiptUser ? '要先「☁️ 登入同步」，主辦人同意你是團員後，就能附上收據。' : !receiptRole ? '確認團員身分中…' : receiptOk() ? '照片會縮小後上傳；卡號等資訊可以先遮住再拍。' : receiptRole === 'pending' ? '主辦人同意你的申請後，就能附上收據。' : '要先在下方「大家的憑證」申請加入，主辦人同意後就能附上收據。';
    box.innerHTML = `<button type="button" class="quiet" data-receipt-add>📷 拍照或選照片</button><small class="muted">${tip}</small>`;
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
    if (!receiptOk()) { toast(receiptRole === 'pending' ? '主辦人同意你的申請後，就能上傳收據' : receiptRole ? '要先申請加入，主辦人同意後才能上傳收據' : '確認團員身分中，請稍等'); if (receiptRole === 'guest') $('#receipts-panel').scrollIntoView({ behavior: 'smooth' }); return; }
    $('#receipt-file').click();
  }
  if (e.target.closest('[data-receipt-remove]')) { receiptDraft = receiptDraft?.rid ? { ...receiptDraft, mode: 'remove' } : null; $('#receipt-file').value = ''; renderReceiptPick(); }
  const view = e.target.closest('[data-receipt]'); if (view) openReceipt(view.dataset.receipt);
  if (e.target.closest('[data-receipt-filter]')) { receiptMineOnly = e.target.closest('[data-receipt-filter]').dataset.receiptFilter === 'mine'; renderReceipts(); }
  if (e.target.closest('[data-receipt-login]')) gsync.open();
  const m = e.target.closest('[data-member]'); if (m) receiptMembership(m.dataset.member, m.dataset.id);
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
  if (receiptUser && receiptOk()) receiptWrite('delete', x.rid);
  else toast('收據還在雲端：登入後到「大家的憑證」點開這張收據就能刪除');
}

async function receiptWrite(kind, rid, entry, d) {
  const g = window.gsync; if (!g) return;
  if (!receiptUser || !receiptOk()) { if (kind !== 'meta') toast(receiptUser ? '主辦人同意你是團員後，收據才能上傳' : '要先用 Google 登入，收據才能上傳'); return; }
  const { db, F } = await g.sdk(), me = receiptUser.uid, metaRef = F.doc(db, 'receipts', rid), imgRef = F.doc(db, 'receiptImgs', rid), old = receiptMap.get(rid);
  if (old && old.uid !== me && !(kind === 'delete' && receiptRole === 'admin')) return;
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
  if (receiptErr) { box.innerHTML = `<p class="muted">${esc(receiptErr)}</p>`; return; }
  if (!receiptRole) { box.innerHTML = '<p class="muted">確認團員身分中…</p>'; return; }
  if (receiptRole === 'guest') { box.innerHTML = `<div class="empty">收據只給這次旅遊團的團員看。<p>按「申請加入」，主辦人同意後就能看到大家的收據。</p><p><button type="button" class="primary" data-member="apply">申請加入</button></p><p class="muted">目前登入：${esc(receiptUser.email || '')}</p></div>`; return; }
  if (receiptRole === 'pending') { box.innerHTML = `<div class="empty">已用「${esc(receiptReq?.name || '')}」送出申請，等主辦人同意。<p>主辦人同意後，這裡會自動出現大家的收據。</p><p><button type="button" class="text-btn" data-member="cancel">取消申請</button></p></div>`; return; }
  const admin = receiptRole === 'admin' ? renderReceiptAdmin() : '';
  const me = receiptUser.uid, all = [...receiptMap.values()].filter(r => r.shared !== false || r.uid === me),
    list = all.filter(r => !receiptMineOnly || r.uid === me).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.at?.seconds || 0) - (b.at?.seconds || 0));
  const chips = `<div class="receipt-filter" role="group" aria-label="篩選收據"><button type="button" class="chip${receiptMineOnly ? '' : ' active'}" data-receipt-filter="all" aria-pressed="${!receiptMineOnly}">全部 ${all.length}</button><button type="button" class="chip${receiptMineOnly ? ' active' : ''}" data-receipt-filter="mine" aria-pressed="${receiptMineOnly}">只看我的 ${all.filter(r => r.uid === me).length}</button></div>`;
  if (!list.length) { box.innerHTML = admin + (all.length ? chips : '') + `<div class="empty">${receiptMineOnly ? '你還沒有上傳收據。' : '還沒有人上傳收據。'}<p>在上面「新增一筆花費」按「📷 拍照或選照片」，就能附上收據。</p></div>`; return; }
  let last = '';
  box.innerHTML = admin + chips + '<div class="receipt-grid">' + list.map(r => {
    const d = +String(r.date || '').slice(8), head = r.date !== last && d ? `<div class="exp-day receipt-day" data-dow="${dowOf(d)}">2/${d}（週${weekdays[d - 1]}）</div>` : ''; last = r.date;
    const cur = r.currency === 'TWD' ? 'TWD' : 'THB';
    return head + `<button type="button" class="receipt-card" data-receipt="${esc(r.id)}"><img src="${r.thumb || ''}" alt="" loading="lazy"><span class="receipt-meta"><b>${esc(r.name || '收據')}</b><span>${cash(+r.amount || 0, cur)}</span><small>${esc(r.by || '旅伴')}${r.uid === me ? '（我）' : ''}${r.shared === false ? '・只有我看得到' : ''}${r.pending ? '・上傳中' : ''}</small></span></button>`;
  }).join('') + '</div>';
}

// 主辦人才看得到：待審核的申請、已同意的團員
function renderReceiptAdmin() {
  const who = (name, mail) => `<span class="member-who"><b>${esc(name || '旅伴')}</b><small>${esc(mail || '')}</small></span>`;
  const btn = (kind, id, text, cls = 'text-btn') => `<button type="button" class="${cls}" data-member="${kind}" data-id="${esc(id)}">${text}</button>`;
  const day = t => t?.seconds ? new Date(t.seconds * 1000) : typeof t === 'number' ? new Date(t) : null;
  const md = d => d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
  const reqs = receiptRequests.length ? receiptRequests.map(r => `<div class="member-row">${who(r.name, r.email)}<span class="member-acts">${btn('approve', r.id, '同意', 'primary')}${btn('reject', r.id, '拒絕', 'text-btn danger')}</span></div>`).join('') : '<p class="muted">目前沒有新的申請。</p>';
  // 帳號名單：登入過的帳號＋已是團員的人（早期同意、還沒再登入的團員也列出來）
  const ids = [...new Set([...receiptAccounts.map(a => a.id), ...receiptMembers.map(m => m.id)])];
  const adminMails = new Set(receiptAdmins.map(a => a.id)), me = receiptUser?.uid;
  const rows = ids.map(id => {
    const a = receiptAccounts.find(x => x.id === id) || {}, m = receiptMembers.find(x => x.id === id), r = receiptRequests.find(x => x.id === id);
    const mail = a.email || m?.email || '', isMe = id === me, owner = a.role === 'owner', admin = isMe || owner || adminMails.has(mail.toLowerCase());
    const tag = isMe ? (receiptOwner ? '主辦人（你）' : '管理者（你）') : owner ? '主辦人' : admin ? '管理者' : m ? '團員' : r ? '申請中' : '未申請';
    return { id, name: m?.name || r?.name || a.gname || mail.split('@')[0], mail, tag, m, isMe, admin, last: day(a.last) };
  }).sort((x, y) => (y.isMe - x.isMe) || (y.admin - x.admin) || ((y.last?.getTime() || 0) - (x.last?.getTime() || 0)));
  const accRows = rows.map(x => `<div class="member-row">${who(x.name, x.mail)}<span class="member-acts"><span class="member-tag${x.m || x.admin ? ' on' : ''}">${x.tag}</span>${x.last ? `<small class="muted">${md(x.last)} 登入</small>` : ''}${x.admin && !x.m ? '' : x.isMe ? '' : x.m ? btn('remove', x.id, '移出團員', 'text-btn danger') : btn('make', x.id, '設為團員', 'quiet')}</span></div>`).join('');
  const memberCount = rows.filter(x => x.m).length;
  const admins = receiptAdmins.map(a => `<div class="member-row">${who(a.id.split('@')[0], a.id)}<span class="member-acts">${receiptOwner ? btn('delAdmin', a.id, '取消管理者', 'text-btn danger') : ''}</span></div>`).join('');
  const det = (k, title, body) => `<details class="member-list" data-k="${k}"${receiptOpen[k] ? ' open' : ''}><summary>${title}</summary>${body}</details>`;
  return `<div class="member-admin"><h4>團員審核<small>只有主辦人和管理者看得到</small></h4><p class="muted">旅伴用 Google 登入後按「申請加入」，會出現在這裡。確認是團員再按「同意」。</p>${receiptRequests.length ? `<p class="member-new">有 ${receiptRequests.length} 個新申請</p>` : ''}${reqs}`
    + det('acc', `帳號名單（${rows.length} 個帳號，${memberCount} 位團員）`, `<p class="muted">登入過這個網站的 Google 帳號。不用等對方申請，也可以直接「設為團員」。</p>${accRows || '<p class="muted">還沒有人登入。</p>'}`)
    + det('adm', `管理者（${receiptAdmins.length} 位）`, `<p class="muted">${receiptOwner ? '管理者和你一樣可以審核團員、刪除收據，但不能新增或取消管理者。' : '管理者名單由主辦人設定。'}</p>${admins || '<p class="muted">還沒有其他管理者。</p>'}${receiptOwner ? '<p><button type="button" class="quiet" data-member="addAdmin">＋ 新增管理者</button></p>' : ''}`)
    + '</div>';
}
document.addEventListener('toggle', e => { const k = e.target.dataset?.k; if (k && e.target.closest('.member-admin')) receiptOpen[k] = e.target.open; }, true);

// ── 點開看大圖 ──
const receiptDlg = document.createElement('dialog');
receiptDlg.className = 'receipt-dialog'; receiptDlg.setAttribute('aria-label', '收據照片');
document.body.appendChild(receiptDlg);
let receiptBlob = '';
async function openReceipt(rid) {
  const r = receiptMap.get(rid), me = receiptUser?.uid;
  if (!receiptUser) { toast('先用 Google 登入，才能看收據'); return gsync?.open(); }
  if (!receiptOk()) { toast('主辦人同意你是團員後，才能看收據'); return; }
  const own = state.expenses.find(x => x.rid === rid);
  if (!r) return toast(own ? '這張收據還沒上傳成功，請編輯這筆花費再附一次照片' : '找不到這張收據，可能已經被刪除');
  const cur = r.currency === 'TWD' ? 'TWD' : 'THB', d = +String(r.date || '').slice(8);
  receiptDlg.innerHTML = `<div class="section-top"><div><h2>${esc(r.name || '收據')}</h2><p class="muted">${cash(+r.amount || 0, cur)}・2/${d}・${esc(r.by || '旅伴')} 上傳${r.shared === false ? '・只有你看得到' : ''}</p></div><button type="button" class="quiet" data-receipt-close>關閉</button></div><div class="receipt-big"><img src="${r.thumb || ''}" alt="收據照片" class="loading"></div><p class="muted receipt-tip">點照片可以放大；手機也可以用兩指放大。</p><div class="form-actions"><a class="quiet btn-link" data-receipt-dl hidden download="收據-${esc(r.name || rid)}.jpg">下載照片</a>${r.uid === me || receiptRole === 'admin' ? '<button type="button" class="quiet danger" data-receipt-del>刪除這張收據</button>' : ''}</div>`;
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
    const r = receiptMap.get(rid), other = r && r.uid !== receiptUser?.uid;
    if (!confirm(other ? `刪除 ${r.by || '旅伴'} 上傳的這張收據？（主辦人權限）` : '刪除這張收據？旅伴也會看不到。（花費紀錄會保留）')) return;
    receiptDlg.close();
    const x = state.expenses.find(x => x.rid === rid);
    if (x) { delete x.rid; save(); renderBudget(); }
    await receiptWrite('delete', rid);
  }
});
renderReceiptPick(); renderReceipts();
