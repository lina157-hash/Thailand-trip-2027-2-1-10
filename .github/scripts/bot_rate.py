"""抓臺灣銀行牌告匯率的泰銖（THB）那一列，存成網站根目錄的 bot-rate.json。

臺灣銀行的網站不讓瀏覽器直接跨站讀取，所以由 GitHub Actions 定時抓好放進儲存庫，
網站再讀同網域的 bot-rate.json。數值是「1 泰銖＝幾台幣」。
匯率沒變就不改檔案（避免多一筆沒意義的修改紀錄）。"""
import csv, io, json, re, sys, urllib.request

URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day'
OUT = 'bot-rate.json'

req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (thai-trip rate bot)'})
with urllib.request.urlopen(req, timeout=30) as r:
    raw = r.read()
    disp = r.headers.get('Content-Disposition', '')

text = raw.decode('utf-8-sig')
row = next((x for x in csv.reader(io.StringIO(text)) if x and x[0].strip() == 'THB'), None)
if not row:
    sys.exit('找不到 THB 這一列：\n' + text[:500])
row = [c.strip() for c in row]
buy, sell = row.index('本行買入'), row.index('本行賣出')
num = lambda s: float(s) if s and float(s) > 0 else None
rate = {
    'cashBuy': num(row[buy + 1]), 'spotBuy': num(row[buy + 2]),
    'cashSell': num(row[sell + 1]), 'spotSell': num(row[sell + 2]),
}
if not rate['cashSell'] or not 0.2 < rate['cashSell'] < 5:
    sys.exit(f'泰銖匯率看起來不對：{row}')

# 下載檔名帶有掛牌時間，例如 ExchangeRate@202610161530.csv
m = re.search(r'@(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})', disp)
if not m:
    sys.exit(f'找不到掛牌時間：{disp!r}')
time = f'{m[1]}-{m[2]}-{m[3]} {m[4]}:{m[5]}'

try:
    old = json.load(open(OUT, encoding='utf-8'))
except FileNotFoundError:
    old = {}
if {k: old.get(k) for k in rate} == rate:
    print('匯率沒有變動', time, rate)
    sys.exit(0)

data = {'source': '臺灣銀行牌告匯率', 'time': time, **rate}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write('\n')
print('已更新', data)
