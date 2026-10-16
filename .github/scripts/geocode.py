"""幫行程裡的地點找座標，存成網站根目錄的 geo.json，給「全行程地圖」用。

讀 trip.json（共同行程）每個活動的 place，已經有座標的就跳過；新的地點先問 OpenStreetMap 的 Nominatim，
找不到再問 Photon。兩個都是免費服務，依它們的使用規則每秒最多查一次。
找不到的地點記成 null，7 天後再試一次；地圖上會把它們列在下面，可以用 Google 地圖開。
座標也可以手動改：直接編輯 geo.json 裡那個地點的 lat、lon，並把 src 改成 "manual"，之後就不會被覆蓋。"""
import json, time, urllib.parse, urllib.request
from datetime import date, timedelta

UA = 'thai-days-trip-site/1.0 (https://github.com/lina157-hash/Thailand-trip-2027-2-1-10)'
TODAY = date.today().isoformat()

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'en'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def country(place, city):
    p = place.lower()
    if city == '桃園' or 'taiwan' in p or 'taoyuan' in p: return 'tw'
    if 'hong kong' in p: return 'hk'
    return 'th'

def nominatim(q, cc):
    j = get('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'jsonv2', 'limit': 1, 'countrycodes': cc}))
    return (float(j[0]['lat']), float(j[0]['lon'])) if j else None

BBOX = {'th': (97.3, 5.6, 105.7, 20.5), 'tw': (119.3, 21.8, 122.1, 25.4), 'hk': (113.8, 22.1, 114.5, 22.6)}
def photon(q, cc):
    j = get('https://photon.komoot.io/api/?' + urllib.parse.urlencode({'q': q, 'limit': 1, 'bbox': ','.join(map(str, BBOX[cc]))}))
    f = (j.get('features') or [None])[0]
    if not f: return None
    lon, lat = f['geometry']['coordinates']
    return (lat, lon)

trip = json.load(open('trip.json', encoding='utf-8'))
places = {}
for e in trip['data']['events']:
    p = (e.get('place') or '').strip()
    if p and p not in places: places[p] = country(p, e.get('city', ''))

try:
    geo = json.load(open('geo.json', encoding='utf-8'))
except FileNotFoundError:
    geo = {}

retry_before = (date.today() - timedelta(days=7)).isoformat()
changed = False
for p, cc in places.items():
    g = geo.get(p)
    if g and (g.get('lat') is not None or g.get('tried', '') > retry_before): continue
    hit, src = None, None
    for fn, name in ((nominatim, 'osm'), (photon, 'photon')):
        try:
            hit = fn(p, cc)
        except Exception as ex:
            print('查詢失敗', name, p, ex)
        time.sleep(1.2)
        if hit: src = name; break
    geo[p] = {'lat': round(hit[0], 6), 'lon': round(hit[1], 6), 'src': src} if hit else {'lat': None, 'lon': None, 'tried': TODAY}
    print(p, '→', geo[p])
    changed = True

if changed:
    with open('geo.json', 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(geo.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
else:
    print('沒有新的地點')
