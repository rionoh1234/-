import sys, json
from PIL import Image, ImageDraw
import numpy as np
from collections import deque
def process(path, names, size=48, cols=4, rows=3):
    im = Image.open(path).convert('RGB'); W, H = im.size
    cw, ch = W / cols, H / rows
    outs = []
    for idx, name in enumerate(names):
        c, r = idx % cols, idx // cols
        x0, y0 = int(c * cw) + 8, int(r * ch) + 8; x1, y1 = int((c + 1) * cw) - 8, int((r + 1) * ch) - 8
        cell = np.asarray(im.crop((x0, y0, x1, y1))).astype(int)
        h, w, _ = cell.shape
        # background = flood fill from border with tolerance vs corner color
        bg = np.median(np.concatenate([cell[0], cell[-1], cell[:, 0], cell[:, -1]]), axis=0)
        diff = np.abs(cell - bg).sum(axis=2)
        isbg = diff < 60
        mask = np.zeros((h, w), bool); q = deque()
        for x in range(w): q.append((0, x)); q.append((h - 1, x))
        for y in range(h): q.append((y, 0)); q.append((y, w - 1))
        while q:
            y, x = q.popleft()
            if mask[y, x] or not isbg[y, x]: continue
            mask[y, x] = True
            if y > 0: q.append((y - 1, x))
            if y < h - 1: q.append((y + 1, x))
            if x > 0: q.append((y, x - 1))
            if x < w - 1: q.append((y, x + 1))
        fg = ~mask
        ys, xs = np.where(fg)
        if len(ys) == 0: print('EMPTY', name); continue
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.dstack([cell.astype(np.uint8), (fg * 255).astype(np.uint8)])
        crop = Image.fromarray(rgba[by0:by1, bx0:bx1], 'RGBA')
        side = max(crop.width, crop.height) + 8
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        small = sq.resize((size, size), Image.LANCZOS)
        # clean semi-transparent fringe
        a = np.asarray(small).copy(); a[..., 3] = np.where(a[..., 3] < 40, 0, a[..., 3])
        small = Image.fromarray(a, 'RGBA')
        small.save(f'out/{name}.png'); outs.append((name, crop.width, crop.height))
    return outs
sheets = json.load(open(sys.argv[1]))
for path, names in sheets:
    print(path, process(path, names))
