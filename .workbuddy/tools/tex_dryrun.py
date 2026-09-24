# -*- coding: utf-8 -*-
"""dry-run：对 >200K 的贴图试算 256 色调色板量化，输出体积与失真（不写盘）。"""
import os, io, math
from PIL import Image, ImageChops, ImageStat

ROOT = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle\assets\resources\Textures"
MIN = 200 * 1024


def psnr_of(a, b):
    ar = a.convert('RGBA')
    br = b.convert('RGBA')
    d = ImageChops.difference(ar, br)
    st = ImageStat.Stat(d)
    rms = math.sqrt(sum(v * v for v in st.rms) / len(st.rms))
    mx = max(e[1] for e in d.getextrema())
    if rms <= 0:
        return 99.0, 0
    return 20 * math.log10(255.0 / rms), mx


def encode(im, **kw):
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True, **kw)
    return buf.getvalue()


lines = []
tot_old = tot_new = 0
for dp, dn, fn in os.walk(ROOT):
    for f in sorted(fn):
        if not f.lower().endswith('.png'):
            continue
        p = os.path.join(dp, f)
        old = os.path.getsize(p)
        if old <= MIN:
            continue
        im = Image.open(p)
        rgba = im.convert('RGBA')
        uniq = len(set(rgba.getdata()))

        # A: 若唯一色 ≤256 → 无损调色板（精确映射）
        if uniq <= 256:
            cols = sorted(set(rgba.getdata()))
            pal = []
            for c in cols:
                pal.extend(c)
            pal += [0] * (1024 - len(pal))
            idx = {c: i for i, c in enumerate(cols)}
            q = Image.new('P', im.size)
            q.putpalette(pal, rawmode='RGBA')
            q.putdata([idx[c] for c in rgba.getdata()])
            data = encode(q)
            q2 = Image.open(io.BytesIO(data))
            ps, mx = psnr_of(rgba, q2)
            lines.append('%-38s %8d -> %8d %5.1f%%  LOSSLESS_P8  uniq=%d' %
                         (os.path.relpath(p, ROOT), old, len(data), 100.0 * len(data) / old, uniq))
            tot_old += old; tot_new += len(data)
            continue

        # B: 有损 256 色量化（无抖动，卡通图不必抖动）
        q = rgba.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE)
        data = encode(q)
        q2 = Image.open(io.BytesIO(data))
        ps, mx = psnr_of(rgba, q2)
        # C: 对照——PNG24 仅 optimize
        d24 = encode(rgba)
        ps24, _ = psnr_of(rgba, Image.open(io.BytesIO(d24)))
        lines.append('%-38s %8d -> %8d %5.1f%%  P8_256 psnr=%5.1f maxdiff=%3d | png24=%d(%.0f%%)' %
                     (os.path.relpath(p, ROOT), old, len(data), 100.0 * len(data) / old,
                      ps, mx, len(d24), 100.0 * len(d24) / old))
        tot_old += old; tot_new += len(data)

lines.append('TOTAL %d -> %d (%.1f%%)' % (tot_old, tot_new, 100.0 * tot_new / tot_old))
txt = '\n'.join(lines)
open(r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle\.workbuddy\tools\_tex_dry.txt", 'w', encoding='utf-8').write(txt)
print(txt)
