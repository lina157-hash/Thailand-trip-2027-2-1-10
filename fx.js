/* 匯率：1 泰銖 = ? 台幣
 *
 * 以臺灣銀行牌告匯率為主：GitHub Actions 平日定時把臺灣銀行的泰銖匯率存成同網站的
 * bot-rate.json（臺灣銀行網站不讓瀏覽器直接讀），這裡讀它。預設用「現金賣出」
 * （拿台幣去換泰銖現金的價格），也提供「即期賣出」給刷卡、轉帳參考。
 * 讀不到臺灣銀行的資料（或太舊）時，才改用公開的國際市場參考匯率；完全取不到時用內建值。
 * 3 小時內不再重抓；離線時沿用上一次的數值。只讀取公開資料，不會送出任何個人資料。 */
const fx = (() => {
  const KEY = 'thai-days-fx-v2';
  const TTL = 3 * 3600 * 1000;    // 距離上次成功取得多久後才再連線
  const BOT_MAX_DAYS = 21;        // 臺灣銀行資料可以舊到幾天（週末、過年連假不掛牌）
  const MAX_AGE_DAYS = 4;         // 國際參考匯率資料比今天舊這麼多天就視為過期，改問下一個來源
  const BUILTIN = { rate: 1.03, date: '2026-10-16', source: 'builtin', bot: null }; // 完全取不到時的內建參考值

  const BOT_URL = 'bot-rate.json';
  // 臺灣銀行資料讀不到時依序嘗試；前兩個是同一份每日更新的開放資料，第三個是另一家獨立來源。
  const SOURCES = [
    { source: 'currency-api', url: 'https://latest.currency-api.pages.dev/v1/currencies/thb.json', read: j => ({ rate: j.thb.twd, date: j.date }) },
    { source: 'currency-api', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/thb.json', read: j => ({ rate: j.thb.twd, date: j.date }) },
    { source: 'er-api', url: 'https://open.er-api.com/v6/latest/THB', read: j => ({ rate: j.rates.TWD, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) }) },
  ];

  // 泰銖兌台幣長年在 0.8～1.1 之間；超出這個寬鬆範圍的數字一律當成壞資料。
  const ok = n => Number.isFinite(n) && n > 0.2 && n < 5;
  const sane = v => !!v && ok(v.rate) && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && (v.source !== 'bot' || !!v.bot && ok(v.bot.cashSell) && ok(v.bot.spotSell) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v.bot.time));
  const ageDays = v => (Date.now() - Date.parse(v.date + 'T00:00:00Z')) / 864e5;

  let current = BUILTIN, fetchedAt = 0, pending = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (sane(saved) && Number.isFinite(saved.fetchedAt) && ['bot', 'currency-api', 'er-api'].includes(saved.source)) {
      current = { rate: saved.rate, date: saved.date, source: saved.source, bot: saved.source === 'bot' ? saved.bot : null };
      fetchedAt = saved.fetchedAt;
    }
  } catch {}

  async function fetchBot() {
    try {
      const r = await fetch(BOT_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json(), num = n => Number.isFinite(+n) && +n > 0 ? +n : null;
      const bot = { time: String(j.time || ''), cashBuy: num(j.cashBuy), cashSell: num(j.cashSell), spotBuy: num(j.spotBuy), spotSell: num(j.spotSell) };
      const v = { rate: bot.cashSell, date: bot.time.slice(0, 10), source: 'bot', bot };
      return sane(v) && ageDays(v) <= BOT_MAX_DAYS ? v : null;
    } catch { return null; }
  }

  async function fetchLatest() {
    const b = await fetchBot();
    if (b) return b;
    if (current.source === 'bot' && ageDays(current) <= BOT_MAX_DAYS) return null; // 暫時讀不到，先沿用手上的臺灣銀行匯率
    let best = null;
    for (const s of SOURCES) {
      try {
        const r = await fetch(s.url, { cache: 'no-cache' });
        if (!r.ok) continue;
        const v = { ...s.read(await r.json()), source: s.source, bot: null };
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
      if (!v) return false;
      if (v.source !== 'bot' && current.source !== 'builtin' && current.source !== 'bot' && v.date < current.date) return false; // 比手上的還舊
      const same = v.source === current.source && v.rate === current.rate && JSON.stringify(v.bot) === JSON.stringify(current.bot);
      current = v;
      fetchedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify({ ...v, fetchedAt })); } catch {}
      return !same;
    }).catch(() => false).finally(() => { pending = null; });
    return pending;
  }

  return {
    get rate() { return current.rate; },     // 1 泰銖 = ? 台幣（臺灣銀行現金賣出；沒有時是國際參考匯率）
    get date() { return current.date; },     // 匯率資料的日期（YYYY-MM-DD）
    get source() { return current.source; }, // 'bot'、'currency-api'、'er-api' 或 'builtin'
    get bot() { return current.bot; },       // 臺灣銀行四種牌價與掛牌時間；沒有時是 null
    refresh,
  };
})();
