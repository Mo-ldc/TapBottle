# -*- coding: utf-8 -*-
"""
贴图压缩（>200K 的 PNG）
------------------------
- 死资源（不在 TEXTURE_PATHS、也无任何绘制调用）：整个文件 + meta 移到 .workbuddy/texture_src/unused/
  -> 记着同步删 Res.ts 的 TEXTURE_PATHS 条目，否则 resources.load 整批失败
- 在用的大图：备份到 .workbuddy/texture_src/，原地覆盖为 256 色调色板 PNG（PNG8）
  · 唯一色 ≤256 的图走**精确调色板**（完全无损）
  · 其余 FASTOCTREE 量化；PSNR < 32 的渐变图改用 Floyd-Steinberg 抖动消色带
用法: python tex_compress.py [--purge-dead]
"""
import os, sys, io, math, shutil
from PIL import Image, ImageChops, ImageStat

PROJ = r"E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\项目\TapBottle"
TEX = os.path.join(PROJ, "assets", "resources", "Textures")
BAK = os.path.join(PROJ, ".workbuddy", "texture_src")
BAK_DEAD = os.path.join(BAK, "unused")
MIN = 200 * 1024

# 已确认无绘制调用的死资源（grep 全工程：只出现在 Res.ts 的预加载列表里）
DEAD = [
    "env/drum.png", "env/fog.png", "env/leaves.png",
    "env/machine_box.png", "env/paw_card.png",
    "ui/wood_banner.png",       # 用的是 wood_banner_l/m/r 三件，整图没人引用
]

# 在用的大图 → 量化
LIVE = [
    "env/wood_table.png", "ui/coin.png", "ui/icon_medal.png",
    "ui/icon_shop2.png", "ui/wood_banner_m.png",
]


def psnr(a, b):
    d = ImageChops.difference(a.convert('RGBA'), b.convert('RGBA'))
    st = ImageStat.Stat(d)
    rms = math.sqrt(sum(v * v for v in st.rms) / len(st.rms))
    if rms <= 0:
        return 99.0
    return 20 * math.log10(255.0 / rms)


def enc(im):
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def lossless_p8(rgba):
    cols = sorted(set(rgba.getdata()))
    if len(cols) > 256:
        return None
    pal = []
    for c in cols:
        pal.extend(c)
    pal += [0] * (1024 - len(pal))
    idx = {c: i for i, c in enumerate(cols)}
    q = Image.new('P', rgba.size)
    q.putpalette(pal, rawmode='RGBA')
    q.putdata([idx[c] for c in rgba.getdata()])
    return q


def main():
    purge_dead = '--purge-dead' in sys.argv
    os.makedirs(BAK, exist_ok=True)
    os.makedirs(BAK_DEAD, exist_ok=True)
    lines = []
    saved = 0

    # ---- 1. 死资源移出 ----
    for rel in DEAD:
        p = os.path.join(TEX, rel.replace('/', os.sep))
        if not os.path.exists(p):
            lines.append('DEAD %-30s (already gone)' % rel)
            continue
        png = os.path.join(BAK_DEAD, os.path.basename(rel))
        meta = os.path.join(BAK_DEAD, os.path.basename(rel) + '.meta')
        shutil.copy2(p, png)
        if os.path.exists(p + '.meta'):
            shutil.copy2(p + '.meta', meta)
        old = os.path.getsize(p)
        if purge_dead:
            os.remove(p)
            if os.path.exists(p + '.meta'):
                os.remove(p + '.meta')
        saved += old
        lines.append('DEAD %-30s %8d B -> %s (backup in texture_src/unused)' %
                     (rel, old, 'moved out' if purge_dead else 'copied only'))

    # ---- 2. 在用大图量化 ----
    for rel in LIVE:
        p = os.path.join(TEX, rel.replace('/', os.sep))
        if not os.path.exists(p):
            lines.append('LIVE %-30s MISSING' % rel)
            continue
        old = os.path.getsize(p)
        im = Image.open(p)
        rgba = im.convert('RGBA')
        uniq = len(set(rgba.getdata()))

        q = lossless_p8(rgba)
        tag = ''
        if q is None:
            q = rgba.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE)
            p1 = psnr(rgba, q)
            if p1 < 32:      # 渐变图：抖动消色带
                q2 = rgba.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
                q = q2
                tag = ' psnr=%.1f(dither)' % psnr(rgba, q2)
            else:
                tag = ' psnr=%.1f' % p1
        else:
            tag = ' LOSSLESS(uniquecolors=%d)' % uniq

        data = enc(q)
        if len(data) >= old:
            lines.append('LIVE %-30s %8d B -> skipped (no gain)' % (rel, old))
            continue
        # 备份原图 + meta，再覆盖
        shutil.copy2(p, os.path.join(BAK, os.path.basename(rel)))
        if os.path.exists(p + '.meta'):
            shutil.copy2(p + '.meta', os.path.join(BAK, os.path.basename(rel) + '.meta'))
        with open(p, 'wb') as f:
            f.write(data)
        saved += old - len(data)
        lines.append('LIVE %-30s %8d B -> %7d B  %5.1f%%%s' %
                     (rel, old, len(data), 100.0 * len(data) / old, tag))

    lines.append('--- saved total: %.2f MB' % (saved / 1048576.0))
    txt = '\n'.join(lines)
    open(os.path.join(PROJ, '.workbuddy', 'tools', '_tex_compress.txt'), 'w', encoding='utf-8').write(txt)
    print(txt)


if __name__ == '__main__':
    main()
