"""暫時用：依 photo-queries.json 到 Wikimedia Commons 搜尋實景照片候選，產生縮圖對照表（.preview/sheet-NN.png）與 candidates.json。"""
import json, time, urllib.parse, urllib.request, io, os, html, re
from PIL import Image, ImageDraw, ImageFont
UA = 'thai-days-trip-site/1.0 (https://github.com/lina157-hash/Thailand-trip-2027-2-1-10)'
def get(url, raw=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read() if raw else json.load(r)
        except Exception as ex:
            print('retry', url[:90], ex); time.sleep(2 + 3 * i)
    return None
def search(q, n=8):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': n, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 300})
    j = get(u) or {}
    pages = sorted((j.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    out = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        if ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp') or ii.get('width', 0) < 640: continue
        md = ii.get('extmetadata') or {}
        strip = lambda v: re.sub('<[^>]+>', '', html.unescape((md.get(v) or {}).get('value', '')))[:60]
        out.append({'title': p['title'][5:], 'w': ii['width'], 'h': ii['height'], 'thumb': ii.get('thumburl'), 'artist': strip('Artist'), 'license': strip('LicenseShortName'), 'date': strip('DateTimeOriginal')[:10]})
    return out
Q = json.load(open('.github/preview/photo-queries.json', encoding='utf-8'))
os.makedirs('.preview', exist_ok=True)
res = {}
for item in Q:
    seen, cands = set(), []
    for q in item['q']:
        for c in search(q):
            if c['title'] in seen: continue
            seen.add(c['title']); cands.append(c)
        time.sleep(0.4)
        if len(cands) >= 8: break
    res[item['key']] = cands[:8]
    print(item['key'], len(res[item['key']]))
json.dump(res, open('.preview/candidates.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
TW, TH, LW, PER = 240, 170, 210, 10
keys = list(res)
for s in range(0, len(keys), PER):
    chunk = keys[s:s + PER]
    sheet = Image.new('RGB', (LW + 8 * (TW + 6), len(chunk) * (TH + 30)), 'white')
    d = ImageDraw.Draw(sheet)
    for r, k in enumerate(chunk):
        y = r * (TH + 30)
        d.text((8, y + 60), k, font=font, fill='black')
        for i, c in enumerate(res[k]):
            x = LW + i * (TW + 6)
            data = get(c['thumb'], raw=True) if c.get('thumb') else None
            if data:
                try:
                    im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((TW, TH)); sheet.paste(im, (x, y))
                except Exception: pass
            d.rectangle((x, y, x + 26, y + 24), fill='black'); d.text((x + 6, y + 1), str(i), font=font, fill='white')
            d.text((x, y + TH + 4), c['title'][:30], font=small, fill='black')
            time.sleep(0.15)
    sheet.save(f'.preview/sheet-{s // PER + 1:02d}.jpg', quality=82)
