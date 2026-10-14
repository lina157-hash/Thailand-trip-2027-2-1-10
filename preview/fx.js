/* 匯率：1 泰銖 = ? 台幣
 *
 * 旅費記帳用它把泰銖和台幣互相換算。第一次打開「旅費記帳」時，會向公開的匯率資料取得
 * 當天的參考匯率並存在這個瀏覽器，12 小時內不再重抓；離線或取不到時沿用上一次的數值。
 * 取得的是市場參考匯率，和實際換匯、刷卡的匯率會有差距，所以頁面上可以改填自訂匯率。
 * 連線時只是讀取公開資料，不會送出任何個人資料。 */
const fx = (() => {
  const KEY = 'thai-days-fx-v1';
  const TTL = 12 * 3600 * 1000;   // 距離上次成功取得多久後才再連線
  const MAX_AGE_DAYS = 4;         // 資料日期比今天舊這麼多天就視為過期，改問下一個來源
  const BUILTIN = { rate: 0.95, date: '2026-10-11', source: 'builtin' }; // 完全取不到時的內建參考值

  // 依序嘗試；前兩個是同一份每日更新的開放資料，第三個是另一家獨立來源。
  const SOURCES = [
    { source: 'currency-api', url: 'https://latest.currency-api.pages.dev/v1/currencies/thb.json', read: j => ({ rate: j.thb.twd, date: j.date }) },
    { source: 'currency-api', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/thb.json', read: j => ({ rate: j.thb.twd, date: j.date }) },
    { source: 'er-api', url: 'https://open.er-api.com/v6/latest/THB', read: j => ({ rate: j.rates.TWD, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) }) },
  ];

  // 泰銖兌台幣長年在 0.8～1.1 之間；超出這個寬鬆範圍的數字一律當成壞資料。
  const sane = v => !!v && Number.isFinite(v.rate) && v.rate > 0.2 && v.rate < 5 && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date);
  const ageDays = v => (Date.now() - Date.parse(v.date + 'T00:00:00Z')) / 864e5;

  let current = BUILTIN, fetchedAt = 0, pending = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (sane(saved) && Number.isFinite(saved.fetchedAt) && ['currency-api', 'er-api'].includes(saved.source)) {
      current = { rate: saved.rate, date: saved.date, source: saved.source };
      fetchedAt = saved.fetchedAt;
    }
  } catch {}

  async function fetchLatest() {
    let best = null;
    for (const s of SOURCES) {
      try {
        const r = await fetch(s.url, { cache: 'no-cache' });
        if (!r.ok) continue;
        const v = { ...s.read(await r.json()), source: s.source };
        if (!sane(v)) continue;
        if (ageDays(v) <= MAX_AGE_DAYS) return v;        // 夠新，直接採用
        if (!best || v.date > best.date) best = v;        // 過期的先記著，看其他來源有沒有比較新的
      } catch {}
    }
    return best;
  }

  /* 需要時才連線（距離上次成功超過 TTL，或 force）。Promise 的結果是「匯率有沒有更新」。 */
  function refresh(force) {
    if (pending) return pending;
    if (!force && fetchedAt && Date.now() - fetchedAt < TTL) return Promise.resolve(false);
    pending = fetchLatest().then(v => {
      if (!v || (current.source !== 'builtin' && v.date < current.date)) return false; // 取不到，或比手上的還舊
      current = v;
      fetchedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify({ ...v, fetchedAt })); } catch {}
      return true;
    }).catch(() => false).finally(() => { pending = null; });
    return pending;
  }

  return {
    get rate() { return current.rate; },     // 1 泰銖 = ? 台幣
    get date() { return current.date; },     // 匯率資料的日期（YYYY-MM-DD）
    get source() { return current.source; }, // 'currency-api'、'er-api' 或 'builtin'
    refresh,
  };
})();
