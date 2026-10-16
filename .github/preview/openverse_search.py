"""暫時用：依 photo-queries.json 到 Openverse（Flickr 等開放授權照片）搜尋實景照片候選，產生縮圖對照表與 candidates.json。"""
import json, time, urllib.parse, urllib.request, io, os
from PIL import Image, ImageDraw, ImageFont
UA = 'thai-days-trip-site/1.0 (https://github.com/lina157-hash/Thailand-trip-2027-2-1-10)'
def get(url, raw=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read() if raw else json.load(r)
        except Exception as ex:
            print('retry', url[:90], ex); time.sleep(4 + 6 * i)
    return None
def search(q, n=12):
    u = 'https://api.openverse.org/v1/images/?' + urllib.parse.urlencode({'q': q, 'page_size': n, 'mature': 'false'})
    j = get(u) or {}
    out = []
    for r in j.get('results', []):
        if r.get('width') and r['width'] < 500: continue
        out.append({k: r.get(k) for k in ('id', 'title', 'url', 'thumbnail', 'creator', 'license', 'license_version', 'foreign_landing_url', 'provider', 'width', 'height')})
    return out
Q = json.load(open('.github/preview/photo-queries.json', encoding='utf-8'))
os.makedirs('.preview', exist_ok=True)
res = {}
for item in Q:
    seen, cands = set(), []
    for q in item['q']:
        for c in search(q):
            if c['url'] in seen: continue
            seen.add(c['url']); cands.append(c)
        time.sleep(3)
        if len(cands) >= 8: break
    res[item['key']] = cands[:8]
    print(item['key'], len(res[item['key']]))
json.dump(res, open('.preview/candidates.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
TW, TH, LW, PER = 240, 170, 210, 10
keys = list(res)
for s in range(0, len(keys), PER):
    chunk = keys[s:s + PER]
    sheet = Image.new('RGB', (LW + 8 * (TW + 6), len(chunk) * (TH + 44)), 'white')
    d = ImageDraw.Draw(sheet)
    for r, k in enumerate(chunk):
        y = r * (TH + 44)
        d.text((8, y + 60), k, font=font, fill='black')
        for i, c in enumerate(res[k]):
            x = LW + i * (TW + 6)
            data = get(c['thumbnail'], raw=True) if c.get('thumbnail') else None
            if not data and c.get('url'): data = get(c['url'], raw=True)
            if data:
                try:
                    im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((TW, TH)); sheet.paste(im, (x, y))
                except Exception: pass
            d.rectangle((x, y, x + 26, y + 24), fill='black'); d.text((x + 6, y + 1), str(i), font=font, fill='white')
            d.text((x, y + TH + 2), (c.get('title') or '')[:30], font=small, fill='black')
            d.text((x, y + TH + 18), f"{c.get('provider')} {c.get('license')}", font=small, fill='gray')
            time.sleep(0.3)
    sheet.save(f'.preview/sheet-{s // PER + 1:02d}.jpg', quality=82)
