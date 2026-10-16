/* 跨裝置同步：用自己的 Google 帳號登入後，個人資料會存到 Firebase，換手機或用電腦登入同一個帳號就會回來。
   同步的內容：旅費記帳、出發清單與注意事項的勾選、伴手禮清單、我想去、我的備註、自選活動、準備提醒、保險資料、我的組別、分帳的「我」。
   每個人只能讀寫自己的資料（Firestore 規則：users/{uid} 只限本人），旅伴與主辦人都看不到。
   主辦人的 GitHub 金鑰、收款紀錄、顯示設定等不在同步範圍。
   FIREBASE_CONFIG 是主辦人 Firebase 專案 thai-trip-2027 的公開設定（不是密碼，安全靠 Firestore 規則）；改成 null 就會關掉整個功能。
   這支檔案要最先載入，才能在其他程式寫入資料時記下修改時間。 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBEDL20GZq3T8zvykWBwPoLR-_Cia4ltzw',
  authDomain: 'thai-trip-2027.firebaseapp.com',
  projectId: 'thai-trip-2027',
  storageBucket: 'thai-trip-2027.firebasestorage.app',
  messagingSenderId: '706749420739',
  appId: '1:706749420739:web:7926c2caab28d0e14f7e76',
};

(() => {
  const SYNC_KEYS = ['thai-days-personal-v1', 'thai-days-name-v1', 'thai-days-joins-v1', 'thai-days-prep-v1', 'thai-days-notes-v1', 'thai-days-insurance-v1', 'thai-days-group-v1', 'thai-days-split-me-v1'];
  const META_KEY = 'thai-days-sync-meta-v1', PREV_KEY = 'thai-days-sync-prev-v1', DONE_FLAG = 'thai-days-synced';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const S = Storage.prototype, setRaw = S.setItem, removeRaw = S.removeItem;
  const ls = () => { try { return window.localStorage; } catch { return null; } };
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  // meta：這台裝置連結的帳號 uid、每個項目最後修改時間 t、還沒上傳的項目 dirty
  let meta = { uid: '', t: {}, dirty: [] };
  try { const m = JSON.parse(get(META_KEY)); if (m && typeof m === 'object') meta = { uid: m.uid || '', t: m.t || {}, dirty: Array.isArray(m.dirty) ? m.dirty : [] }; } catch {}
  const saveMeta = () => { try { setRaw.call(localStorage, META_KEY, JSON.stringify(meta)); } catch {} };

  let fb = null, user = null, ref = null, pushTimer = null, unsub = null, linking = false, lastSync = 0;

  // 其他程式寫入同步項目時，記下修改時間，登入中就排程上傳
  const touched = k => { meta.t[k] = Date.now(); if (!meta.dirty.includes(k)) meta.dirty.push(k); saveMeta(); schedulePush(); };
  S.setItem = function (k, v) { const st = ls(), hit = this === st && SYNC_KEYS.includes(k), old = hit ? get(k) : null; setRaw.call(this, k, v); if (hit && old !== String(v)) touched(k); };
  S.removeItem = function (k) { const st = ls(), hit = this === st && SYNC_KEYS.includes(k) && get(k) !== null; removeRaw.call(this, k); if (hit) touched(k); };
  if (!FIREBASE_CONFIG) return;

  const $ = s => document.querySelector(s);
  const note = msg => typeof toast === 'function' ? toast(msg) : alert(msg);
  const setClass = () => { document.documentElement.classList.toggle('synced', !!user); renderBtn(); renderDialog(); };

  // 判斷一個項目是不是「有內容」，用來決定第一次登入時要不要問用哪一份
  function hasContent(k, v) {
    if (v === null || v === '' || v === '{}' || v === '[]') return false;
    if (k !== 'thai-days-personal-v1') return true;
    try { const s = JSON.parse(v); return !!(s.expenses?.length || s.checks?.some(c => c.done) || Object.values(s.mynotes || {}).some(x => String(x).trim()) || s.favs?.length || s.gifts?.length || s.limit || s.rate); } catch { return true; }
  }
  const localHas = () => SYNC_KEYS.some(k => hasContent(k, get(k)));
  const remoteHas = v => SYNC_KEYS.some(k => v[k] && hasContent(k, v[k].d));

  function loadSdk() {
    if (!fb) fb = Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(SDK + f))).then(([app, auth, store]) => {
      const a = app.initializeApp(FIREBASE_CONFIG);
      return { auth: auth.getAuth(a), A: auth, db: store.getFirestore(a), F: store };
    });
    return fb;
  }

  function schedulePush() { if (!user || linking) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1200); }
  async function push(keys = meta.dirty) {
    if (!user || !keys.length) return;
    const { F } = await fb, v = {};
    keys.forEach(k => { v[k] = { d: get(k), t: meta.t[k] || Date.now() }; });
    try {
      await F.setDoc(ref, { v, at: F.serverTimestamp() }, { merge: true });
      meta.dirty = meta.dirty.filter(k => !keys.includes(k)); saveMeta(); lastSync = Date.now(); renderDialog();
    } catch (e) { console.warn('sync push', e); }
  }

  // 雲端比較新的項目寫回這台裝置；有改到就重新整理，讓各頁讀到新資料
  function pull(v) {
    let changed = false; const up = [];
    SYNC_KEYS.forEach(k => {
      const r = v[k], lt = meta.t[k] || 0;
      if (r && r.t > lt) {
        if (get(k) !== r.d) { try { r.d === null ? removeRaw.call(localStorage, k) : setRaw.call(localStorage, k, r.d); changed = true; } catch {} }
        meta.t[k] = r.t; meta.dirty = meta.dirty.filter(x => x !== k);
      } else if (lt > (r?.t || 0) && !meta.dirty.includes(k)) up.push(k);
    });
    saveMeta(); lastSync = Date.now();
    if (up.length) { meta.dirty.push(...up); saveMeta(); schedulePush(); }
    if (changed) reloadSoon();
    renderDialog();
  }
  function reloadSoon() {
    const busy = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || !!document.querySelector('dialog[open]:not(#sync-dialog)'); };
    const go = () => { try { sessionStorage.setItem(DONE_FLAG, '1'); } catch {} location.reload(); };
    if (!busy()) return go();
    const bar = $('#sync-bar'); if (bar) bar.hidden = false;
  }

  // 這台裝置第一次連到這個帳號：雲端和這台都有資料時，問要用哪一份
  async function link() {
    const { F } = await fb;
    linking = true;
    try {
      const snap = await F.getDoc(ref), v = (snap.exists() && snap.data().v) || {};
      const now = Date.now();
      if (remoteHas(v) && localHas()) {
        const useCloud = confirm('雲端已經有你在其他裝置的資料。\n\n按「確定」：改用雲端的資料（這台裝置現在的資料會先另外存一份）。\n按「取消」：用這台裝置的資料，覆蓋雲端。');
        if (useCloud) {
          try { setRaw.call(localStorage, PREV_KEY, JSON.stringify(Object.fromEntries(SYNC_KEYS.map(k => [k, get(k)])))); } catch {}
          SYNC_KEYS.forEach(k => { meta.t[k] = 0; }); meta.dirty = [];
        } else SYNC_KEYS.forEach(k => { meta.t[k] = now; });
      } else if (remoteHas(v)) { SYNC_KEYS.forEach(k => { meta.t[k] = 0; }); meta.dirty = []; }
      else SYNC_KEYS.forEach(k => { if (get(k) !== null) meta.t[k] = now; });
      meta.uid = user.uid; meta.dirty = SYNC_KEYS.filter(k => (meta.t[k] || 0) > (v[k]?.t || 0)); saveMeta();
      linking = false;
      pull(v); await push();
    } catch (e) { linking = false; throw e; }
  }

  async function onUser(u) {
    if (unsub) { unsub(); unsub = null; }
    user = u; setClass();
    if (!u) return;
    const { F, db } = await fb;
    ref = F.doc(db, 'users', u.uid);
    try {
      if (meta.uid !== u.uid) await link();
      unsub = F.onSnapshot(ref, snap => { if (!snap.metadata.hasPendingWrites && snap.exists()) pull(snap.data().v || {}); }, e => console.warn('sync listen', e));
      schedulePush();
    } catch (e) { console.warn('sync link', e); note('同步失敗：' + errText(e)); }
  }

  const errText = e => ({
    'auth/unauthorized-domain': 'Firebase 還沒允許這個網址，請主辦人在 Authentication 的「授權網域」加上 lina157-hash.github.io',
    'auth/popup-blocked': '瀏覽器擋住了登入視窗，請允許彈出視窗後再試一次',
    'auth/network-request-failed': '網路不穩，請稍後再試',
    'permission-denied': '雲端資料庫拒絕存取，請主辦人確認 Firestore 規則已發布',
  })[e?.code] || (e?.message || '未知錯誤');

  // ── 畫面：右上角「登入同步」按鈕與說明視窗 ──
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'quiet'; btn.id = 'sync-btn';
  const exp = $('#export'); exp?.parentNode.insertBefore(btn, exp);
  function renderBtn() { btn.textContent = user ? '☁️ 已同步' : '☁️ 登入同步'; btn.setAttribute('aria-label', user ? '跨裝置同步：已登入' : '跨裝置同步：用 Google 登入'); }
  const dlg = document.createElement('dialog');
  dlg.id = 'sync-dialog'; dlg.className = 'sync-dialog'; dlg.setAttribute('aria-label', '跨裝置同步');
  document.body.appendChild(dlg);
  const bar = document.createElement('div');
  bar.id = 'sync-bar'; bar.className = 'sync-bar'; bar.hidden = true;
  bar.innerHTML = '<span>其他裝置有新的資料</span><button type="button" class="primary">重新整理</button>';
  bar.querySelector('button').onclick = () => { try { sessionStorage.setItem(DONE_FLAG, '1'); } catch {} location.reload(); };
  document.body.appendChild(bar);

  let sdkReady = false, sdkErr = '';
  function renderDialog() {
    if (!dlg.open) return;
    const t = lastSync ? new Date(lastSync).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '';
    dlg.innerHTML = `<div class="section-top"><h2>跨裝置同步</h2><button type="button" class="quiet" data-sync-close>關閉</button></div>`
      + (user
        ? `<p>已用 Google 帳號 <b>${escHtml(user.email || user.displayName || '')}</b> 登入。在其他手機或電腦用同一個帳號登入，就會看到同樣的資料。</p><p class="muted">${t ? `最後同步：${t}` : '同步中…'}${meta.dirty.length ? '（有修改還沒上傳，連上網路後會自動上傳）' : ''}</p><div class="form-actions"><button type="button" class="quiet" data-sync-now>立即同步</button><button type="button" class="quiet danger" data-sync-out>登出</button></div>`
        : `<p>用自己的 Google 帳號登入，旅費記帳、出發清單勾選、伴手禮、我想去、我的備註等就會存到雲端。換手機或用電腦登入同一個帳號，資料就會回來。</p><p class="muted">只有你自己看得到，旅伴和主辦人都看不到。</p><div class="form-actions"><button type="button" class="primary" data-sync-in${sdkReady ? '' : ' disabled'}>${sdkReady ? '用 Google 登入' : sdkErr ? '目前無法連線' : '準備中…'}</button></div>${sdkErr ? `<p class="muted">${escHtml(sdkErr)}</p>` : ''}`);
  }
  const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  btn.onclick = () => { dlg.showModal(); renderDialog(); };
  dlg.addEventListener('click', async e => {
    if (e.target === dlg || e.target.closest('[data-sync-close]')) return dlg.close();
    if (e.target.closest('[data-sync-in]')) {
      // 登入視窗要在點擊當下開，所以 SDK 已在打開說明視窗前先載好
      const { auth, A } = await fb;
      try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); dlg.close(); note('已登入，資料會自動同步'); }
      catch (err) { if (!/popup-closed|cancelled-popup/.test(err.code || '')) note('登入失敗：' + errText(err)); }
    }
    if (e.target.closest('[data-sync-now]')) { await push(SYNC_KEYS.filter(k => get(k) !== null || meta.t[k])); note('已同步'); }
    if (e.target.closest('[data-sync-out]')) {
      if (!confirm('登出後，這台裝置上的資料會保留，但之後的修改不會再同步。確定登出？')) return;
      await push(); const { auth, A } = await fb; await A.signOut(auth); meta.uid = ''; saveMeta(); dlg.close(); note('已登出');
    }
  });

  renderBtn();
  loadSdk().then(({ auth, A }) => { sdkReady = true; renderDialog(); A.onAuthStateChanged(auth, onUser); })
    .catch(e => { sdkErr = '載入不了 Google 登入（可能沒有網路），資料仍會存在這台裝置。'; console.warn('sync sdk', e); renderDialog(); });
  addEventListener('online', () => schedulePush());
  try { if (sessionStorage.getItem(DONE_FLAG)) { sessionStorage.removeItem(DONE_FLAG); addEventListener('load', () => note('已同步其他裝置的最新資料')); } } catch {}
})();
