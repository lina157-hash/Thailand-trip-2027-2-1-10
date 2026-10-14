/* 旅途工具：給司機看的泰文卡、緊急聯絡、泰語常用句、加到手機主畫面。
   內容固定寫在這裡，不經過共同行程；只有「我的保險電話」存在各自的裝置（localStorage）。
   飯店地址與電話整理自公開資料，出發前請再和訂房確認信對照一次。 */
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const map = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const tel = n => 'tel:' + n.replace(/[^+\d]/g, '');

  /* ── 給司機看：泰文名稱與地址 ── */
  const PLACES = [
    { id: 'mercure', when: '2/1–2/4 · 芭達雅', zh: 'Mercure 芭達雅海洋度假飯店',
      th: 'โรงแรมเมอร์เคียว พัทยา โอเชี่ยน รีสอร์ท', en: 'Mercure Pattaya Ocean Resort',
      addrTh: '463/100 หมู่ 9 ถนนพัทยาสาย 2 ตำบลหนองปรือ อำเภอบางละมุง ชลบุรี 20150',
      addrEn: '463/100 Moo 9, Pattaya Second Road, Nong Prue, Bang Lamung, Chonburi 20150',
      phone: '+66 38 769 688' },
    { id: 'ibis', when: '2/4–2/10 · 曼谷', zh: 'ibis Styles 曼谷拉差達',
      th: 'โรงแรมไอบิส สไตล์ กรุงเทพ รัชดา', en: 'ibis Styles Bangkok Ratchada',
      addrTh: '212 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310 (ใกล้ MRT ห้วยขวาง)',
      addrEn: '212 Ratchadaphisek Rd, Huai Khwang, Bangkok 10310 (near MRT Huai Khwang)',
      phone: '+66 2 820 8888' },
    { id: 'jodd', when: '曼谷 · 夜市', zh: '喬德夜市（Jodd Fairs 拉差達）',
      th: 'ตลาดนัดจ๊อดแฟร์ รัชดา', en: 'Jodd Fairs Ratchada',
      addrTh: 'ถนนรัชดาภิเษก ข้างบิ๊กซี เพลส รัชดาภิเษก (MRT ศูนย์วัฒนธรรมแห่งประเทศไทย ทางออก 4) — ไม่ใช่ที่เซ็นทรัลพระราม 9 เดิม',
      addrEn: 'Ratchadaphisek Rd, next to Big C Place Ratchadaphisek (MRT Thailand Cultural Centre, Exit 4). Not the old Central Rama 9 site.',
      phone: '', map: 'Jodd Fairs Ratchada' },
    { id: 'bkk', when: '2/10 · 回程', zh: '曼谷蘇凡納布機場',
      th: 'สนามบินสุวรรณภูมิ', en: 'Suvarnabhumi Airport (BKK)',
      addrTh: 'ผู้โดยสารขาออก ชั้น 4', addrEn: 'Departures, 4th floor', phone: '' },
  ];

  /* ── 緊急聯絡 ── */
  const EMERGENCY = [
    { title: '泰國當地', items: [
      ['觀光警察（可說英文）', '1155'],
      ['報警', '191'],
      ['救護車', '1669'],
      ['消防', '199'],
    ] },
    { title: '台灣的協助', items: [
      ['駐泰國台北經濟文化辦事處　急難救助（車禍、搶劫、被捕等緊急狀況）', '+66 81 666 4006'],
      ['駐泰國台北經濟文化辦事處　一般業務', '+66 2 119 3555'],
      ['外交部 旅外國人急難救助', '+886 800 085 095'],
    ], note: '辦事處地址：40/64 Vibhavadi-Rangsit 66, Laksi, Bangkok 10210。急難電話只用在真正緊急的狀況。' },
    { title: '飯店', items: [
      ['Mercure Pattaya Ocean Resort（2/1–2/4）', '+66 38 769 688'],
      ['ibis Styles Bangkok Ratchada（2/4–2/10）', '+66 2 820 8888'],
    ] },
  ];
  const HOSPITALS = [
    ['芭達雅', '曼谷醫院芭達雅分院', 'Bangkok Hospital Pattaya'],
    ['曼谷', '帕蘭九醫院（離 ibis Styles 很近）', 'Praram 9 Hospital Bangkok'],
  ];

  /* ── 泰語常用句：句尾加 ค่ะ（女生，kâ）或 ครับ（男生，khráp）比較有禮貌 ── */
  const PHRASES = [
    { title: '打招呼', items: [
      ['你好', 'สวัสดี', 'sa-wàt-dii'],
      ['謝謝', 'ขอบคุณ', 'khòp-khun'],
      ['不好意思／對不起', 'ขอโทษ', 'khǒo-thôot'],
      ['沒關係', 'ไม่เป็นไร', 'mâi pen rai'],
      ['我聽不懂', 'ไม่เข้าใจ', 'mâi khâo-jai'],
    ] },
    { title: '吃東西', items: [
      ['不要辣', 'ไม่เผ็ด', 'mâi phèt'],
      ['小辣就好', 'เผ็ดนิดหน่อย', 'phèt nít-nòi'],
      ['不要香菜', 'ไม่ใส่ผักชี', 'mâi sài phàk-chii'],
      ['不要加冰', 'ไม่ใส่น้ำแข็ง', 'mâi sài nám-khǎeng'],
      ['我要這個', 'เอาอันนี้', 'ao an-níi'],
      ['好吃', 'อร่อย', 'a-ròi'],
      ['買單', 'เช็คบิล', 'chék-bin'],
    ] },
    { title: '買東西', items: [
      ['多少錢？', 'เท่าไหร่', 'thâo-rài'],
      ['可以便宜一點嗎？', 'ลดหน่อยได้ไหม', 'lót nòi dâi mái'],
      ['可以刷卡嗎？', 'จ่ายบัตรได้ไหม', 'jàai bàt dâi mái'],
    ] },
    { title: '交通', items: [
      ['請跳錶', 'เปิดมิเตอร์ได้ไหม', 'pə̀ət mí-tôe dâi mái'],
      ['請在這裡停', 'จอดตรงนี้', 'jòt trong-níi'],
      ['請帶我去這裡', 'ไปที่นี่', 'pai thîi-nîi'],
    ] },
    { title: '求助', items: [
      ['廁所在哪裡？', 'ห้องน้ำอยู่ที่ไหน', 'hông-náam yùu thîi-nǎi'],
      ['救命／請幫幫我', 'ช่วยด้วย', 'chûai dûai'],
      ['我不舒服', 'ไม่สบาย', 'mâi sa-baai'],
      ['請叫救護車', 'เรียกรถพยาบาลด้วย', 'rîak rót pha-yaa-baan dûai'],
    ] },
  ];

  const box = document.querySelector('#tools-list');
  if (!box) return;
  const INS_KEY = 'thai-days-insurance-v1';
  let insurance = '', installEvent = null;
  try { insurance = localStorage.getItem(INS_KEY) || ''; } catch {}
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';

  const section = (n, id, title, body, open) => `<details class="note-section tool-section" data-section="${id}"${open ? ' open' : ''}><summary><span class="note-num">${String(n).padStart(2, '0')}</span><span class="note-title">${title}</span></summary><div class="tool-body">${body}</div></details>`;

  function render() {
    const driver = `<p class="note-lead">點一張卡片會放大成全螢幕，直接拿給計程車或 Grab 司機看。</p><div class="driver-cards">${PLACES.map(p => `<button type="button" class="driver-card" data-driver="${p.id}"><span class="eyebrow">${esc(p.when)}</span><strong lang="th">${esc(p.th)}</strong><span>${esc(p.zh)}</span></button>`).join('')}</div>`;
    const sos = EMERGENCY.map(g => `<h4>${esc(g.title)}</h4><ul class="sos-list">${g.items.map(([label, num]) => `<li><span>${esc(label)}</span><a class="sos-num" href="${tel(num)}">${esc(num)}</a></li>`).join('')}</ul>${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}`).join('')
      + `<h4>醫院</h4><ul class="sos-list">${HOSPITALS.map(([city, zh, q]) => `<li><span>${esc(city)}　${esc(zh)}</span><a class="map-link" href="${map(q)}" target="_blank" rel="noopener noreferrer">地圖</a></li>`).join('')}</ul>`
      + `<h4>我的旅遊保險</h4><label class="ins-label">海外急難救助電話（只存在這台裝置）<input id="ins-phone" type="tel" maxlength="40" placeholder="例如 +886 2 1234 5678" value="${esc(insurance)}"></label>${insurance ? `<a class="quiet ins-call" href="${tel(insurance)}">撥打 ${esc(insurance)}</a>` : ''}`
      + `<p class="note-lead sos-tip">護照遺失：先到附近警察局報案、拿報案證明，再聯絡辦事處補辦回國用的證件。</p>`;
    const phrases = `<p class="note-lead">句尾加 <b lang="th">ค่ะ</b>（女生，kâ）或 <b lang="th">ครับ</b>（男生，khráp）比較有禮貌。${canSpeak ? '按喇叭可以聽發音（要看手機有沒有泰語語音）。' : ''}</p>`
      + PHRASES.map(g => `<h4>${esc(g.title)}</h4><ul class="phrase-list">${g.items.map(([zh, th, ro]) => `<li><span class="zh">${esc(zh)}</span><span class="th" lang="th">${esc(th)}</span><span class="ro">${esc(ro)}</span>${canSpeak ? `<button type="button" class="speak" data-say="${esc(th)}" aria-label="播放「${esc(zh)}」的泰語發音">${SPEAK}</button>` : ''}</li>`).join('')}</ul>`).join('');
    const install = `<p>加到主畫面後，點圖示就能像 App 一樣全螢幕打開，沒有網路時也能看最近看過的行程。</p><button type="button" class="primary" id="install-app"${installEvent ? '' : ' hidden'}>安裝到這台裝置</button><ol class="install-steps"><li><b>iPhone（Safari）</b>：按下方的分享按鈕 → 「加入主畫面」。</li><li><b>Android（Chrome）</b>：按右上角 ⋮ → 「安裝應用程式」或「加到主畫面」。</li></ol>`;
    box.innerHTML = section(1, 'driver', '給司機看', driver, true) + section(2, 'sos', '緊急聯絡', sos, true) + section(3, 'phrase', '泰語常用句', phrases, false) + section(4, 'install', '加到手機主畫面', install, false);
  }
  render();

  /* 全螢幕司機卡 */
  const dlg = document.querySelector('#driver-dialog');
  function openDriver(id) {
    const p = PLACES.find(x => x.id === id); if (!p) return;
    dlg.querySelector('.driver-body').innerHTML = `<p class="driver-ask" lang="th">กรุณาไปส่งที่</p><p class="driver-ask-zh">請載我到：</p><h2 lang="th">${esc(p.th)}</h2><p class="driver-en">${esc(p.en)}</p><p class="driver-addr" lang="th">${esc(p.addrTh)}</p><p class="driver-addr-en">${esc(p.addrEn)}</p><div class="driver-actions">${p.phone ? `<a class="quiet" href="${tel(p.phone)}">打給飯店 ${esc(p.phone)}</a>` : ''}<a class="quiet" href="${map(p.map || p.en)}" target="_blank" rel="noopener noreferrer">開地圖</a></div>`;
    dlg.showModal();
  }
  window.openDriverCard = openDriver;
  dlg.querySelector('.driver-close').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  box.addEventListener('click', e => {
    const d = e.target.closest('[data-driver]'); if (d) return openDriver(d.dataset.driver);
    const s = e.target.closest('[data-say]');
    if (s && canSpeak) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s.dataset.say); u.lang = 'th-TH'; u.rate = .85;
      const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('th'));
      if (v) u.voice = v; else if (speechSynthesis.getVoices().length) toast('這台裝置可能沒有泰語語音，念出來的聲音會不準。');
      speechSynthesis.speak(u);
    }
  });
  box.addEventListener('change', e => {
    if (e.target.id !== 'ins-phone') return;
    insurance = e.target.value.trim();
    try { if (insurance) localStorage.setItem(INS_KEY, insurance); else localStorage.removeItem(INS_KEY); } catch {}
    const open = {}; box.querySelectorAll('details').forEach(d => { open[d.dataset.section] = d.open; });
    render();
    box.querySelectorAll('details').forEach(d => { d.open = open[d.dataset.section]; });
  });

  /* Android／電腦的 Chrome 會提供「安裝」事件；iPhone 只能從分享選單加入主畫面 */
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; const b = document.querySelector('#install-app'); if (b) b.hidden = false; });
  box.addEventListener('click', async e => {
    if (!e.target.closest('#install-app') || !installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null; e.target.closest('#install-app').hidden = true;
  });
  window.addEventListener('appinstalled', () => toast('已加到主畫面'));
})();
