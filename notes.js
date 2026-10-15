/* 注意事項：出發前與旅途中要留意的事，每一項都可以勾選「已確認」。
   勾選狀態只存在這台裝置（localStorage），不會和旅伴同步，也不包含在個人備份裡。
   內容整理自主辦人提供的「泰國旅遊注意事項」圖卡。 */
(() => {
  const KEY = 'thai-days-notes-v1';
  const SECTIONS = [
    { id: 'entry', title: '入境前準備', items: [
      ['passport', '護照效期 6 個月以上，確認沒有破損'],
      ['cash', '泰國海關會隨機抽查現金：每人需備等值 2 萬泰銖、每個家庭 4 萬泰銖（美金、台幣等外幣也可以）'],
      ['vape', '不攜帶電子煙；菸、酒及藥品請先確認限額與規定'],
      ['photo', '部分區域禁止拍照，排隊通關時請依現場指示'],
    ] },
    { id: 'tdac', title: '泰國 TDAC 電子入境卡', steps: true,
      lead: '請在抵達泰國前 3 天內（含抵達當天）上官方網站填寫。TDAC 不是簽證，每次入境都要重新填。',
      link: ['https://tdac.immigration.go.th', '前往 TDAC 官方網站 tdac.immigration.go.th'],
      items: [
        ['prepare', '準備資料：護照、航班、抵達日期、泰國住宿地址、Email'],
        ['open', '打開官網，選擇 Arrival Card，填寫個人及護照資料'],
        ['trip', '填寫行程：交通方式、航班、入境日期與住宿資訊'],
        ['health', '健康申報：依頁面提示填寫健康與旅行資訊'],
        ['check', '核對並提交：用英文填寫，確認姓名、護照號碼、日期和 Email'],
        ['save', '保存憑證：下載電子入境卡，存在手機並備份郵件'],
      ] },
    { id: 'docs', title: '重要證件', items: [
      ['passport2', '護照（效期 6 個月以上、沒有破損）'],
      ['money', '現金、信用卡'],
    ] },
    { id: 'tech', title: '電子產品', items: [
      ['volt', '泰國電壓是 220V'],
      ['plug', '泰國和台灣的插座「幾乎相同」，還是建議帶一個萬用轉接頭'],
      ['charger', '電器充電器'],
    ] },
    { id: 'daily', title: '日常用品', items: [
      ['umbrella', '2 月不是雨季，但天氣多變，帶一把輕便雨傘，也能遮陽'],
      ['sun', '帽子、墨鏡和防曬用品，陽光很強'],
      ['swim', '飯店有游泳池，記得帶泳衣、泳帽等泳具'],
      ['fan', '白天很熱，可以帶隨身小電扇'],
    ] },
    { id: 'meds', title: '隨身藥包', items: [
      ['stomach', '飲食和水質跟台灣不同，帶平常習慣的腸胃藥'],
      ['mosquito', '戶外和綠意多的地方蚊蟲多，帶防蚊液'],
      ['rx', '處方藥請保留原包裝與處方'],
      ['special', '特殊藥品請先確認攜帶規定'],
    ] },
    { id: 'food', title: '飲水與飲食', items: [
      ['water', '喝密封瓶裝水，不直接喝自來水'],
      ['ice', '冰塊注意來源，海鮮與肉類盡量吃熟食'],
      ['stall', '街邊攤挑現做、客人多、看起來乾淨的'],
    ] },
    { id: 'dont', title: '泰國禁止事項', items: [
      ['head', '不碰別人的頭，也不要用腳指人或指東西'],
      ['buddha', '不觸摸、攀爬佛像；進佛殿要脫鞋，保持尊重'],
      ['dress', '進寺廟穿著得體（遮肩、過膝），依規定拍照'],
      ['smoke', '禁菸區不吸菸，不攜帶電子菸入境'],
      ['passport3', '不要把護照拿去抵押，不亂丟垃圾'],
      ['outside', '飯店通常禁止攜帶外食（以各飯店規定為準）'],
      ['alcohol', '部分宗教場所禁止飲酒'],
      ['unknown', '不吃來路不明的食物或飲料'],
      ['drone', '無人機須先申請許可，機場附近禁止飛行'],
      ['pickup', '不隨意撿拾或帶走不明物品'],
    ] },
  ];

  let done = {};
  try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && typeof raw === 'object' && !Array.isArray(raw)) done = raw; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch {} };
  const keyOf = (s, i) => s.id + '.' + i[0];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const total = SECTIONS.reduce((a, s) => a + s.items.length, 0);
  const box = document.querySelector('#notes-list');
  if (!box) return;

  function render() {
    const all = Object.keys(done).filter(k => done[k]).length;
    document.querySelector('#notes-progress').textContent = `已確認 ${all} / ${total} 項`;
    document.querySelector('#notes-bar').style.width = (all / total * 100) + '%';
    box.innerHTML = SECTIONS.map((s, n) => {
      const c = s.items.filter(i => done[keyOf(s, i)]).length;
      const list = s.items.map((i, k) => `<li class="note-item"><label><input type="checkbox" data-note="${esc(keyOf(s, i))}" ${done[keyOf(s, i)] ? 'checked' : ''}>${s.steps ? `<b class="step">${k + 1}</b>` : ''}<span>${esc(i[1])}</span></label></li>`).join('');
      return `<details class="note-section${c === s.items.length ? ' complete' : ''}" data-section="${s.id}" ${c === s.items.length ? '' : 'open'}>`
        + `<summary><span class="note-num">${String(n + 1).padStart(2, '0')}</span><span class="note-title">${esc(s.title)}</span><span class="note-count">${c} / ${s.items.length}</span></summary>`
        + (s.lead ? `<p class="note-lead">${esc(s.lead)}</p>` : '')
        + `<${s.steps ? 'ol' : 'ul'} class="note-items">${list}</${s.steps ? 'ol' : 'ul'}>`
        + (s.link ? `<a class="primary note-link" href="${s.link[0]}" target="_blank" rel="noopener noreferrer">${esc(s.link[1])}</a>` : '')
        + `</details>`;
    }).join('');
  }
  box.addEventListener('change', e => {
    const k = e.target.dataset.note; if (!k) return;
    if (e.target.checked) done[k] = true; else delete done[k];
    save();
    // 重新繪製後保留每一段目前的展開／收合狀態，避免畫面跳動；完成的段落要下次打開頁面才會自動收合
    const open = {}; box.querySelectorAll('details').forEach(d => { open[d.dataset.section] = d.open; });
    render();
    box.querySelectorAll('details').forEach(d => { if (d.dataset.section in open) d.open = open[d.dataset.section]; });
  });
  document.querySelector('#notes-reset').addEventListener('click', () => {
    if (!Object.keys(done).length || !confirm('清除這台裝置上所有「注意事項」的勾選？')) return;
    done = {}; save(); render();
  });
  render();
})();
