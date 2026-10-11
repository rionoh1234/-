# 엠블럼·국기를 내려받아 64px PNG로 줄이고 data URI 묶음(dist/logo-data.js)을 만듭니다.
# Artifact(외부 이미지 차단 환경) 빌드용.  사용: python3 tools/embed-logos.py
import base64, io, json, os, re, sys, time, urllib.request
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'src', 'logos.js'), encoding='utf-8').read()
LOGOS = json.loads(src[src.index('{'):src.rindex('}') + 1])
data = open(os.path.join(root, 'src', 'data.js'), encoding='utf-8').read()
flags = sorted(set(re.findall(r"'[^']+': '([a-z]{2}(?:-[a-z]{3})?)'", data[data.index('FLAG_CODE'):data.index('};', data.index('FLAG_CODE'))])))
cache = os.path.join(root, 'dist', 'logo-cache'); os.makedirs(cache, exist_ok=True)
def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return open(path, 'rb').read()
    for i in range(4):
        try:
            b = urllib.request.urlopen(url, timeout=30).read()
            open(path, 'wb').write(b); time.sleep(0.2); return b
        except Exception as e:
            print('retry', url, e); time.sleep(2)
    return None
def uri(b, size):
    im = Image.open(io.BytesIO(b)).convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()
res = {'clubs': {}, 'leagues': {}, 'flags': {}}
for kind in ('clubs', 'leagues'):
    for k, u in LOGOS[kind].items():
        b = fetch(u + '/small', os.path.join(cache, f'{kind}-{k}.png'))
        if b: res[kind][k] = uri(b, 96)
for c in flags:
    b = fetch(f'https://flagcdn.com/w80/{c}.png', os.path.join(cache, f'flag-{c}.png'))
    if b: res['flags'][c] = uri(b, 48)
out = os.path.join(root, 'dist', 'logo-data.js')
open(out, 'w').write('const LOGO_DATA = ' + json.dumps(res) + ';\n')
print('clubs', len(res['clubs']), 'leagues', len(res['leagues']), 'flags', len(res['flags']), 'KB', os.path.getsize(out) // 1024)
