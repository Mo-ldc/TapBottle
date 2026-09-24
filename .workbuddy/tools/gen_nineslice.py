#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_nineslice.py —— 生成九宫格（9-slice）UI 皮肤贴图。

背景：工程原来所有面板/按钮都用 Graphics 运行时画圆角矩形（Theme.ts 的 woodPlate /
chipPlate）。缺点是无法在编辑器里预览与调整。改成九宫格 Sprite 后，外观可直接所见即所得，
但**必须保持「可染色」能力** —— 现有代码传入十几种底色（cream / gold / green / #C98A46 …），
所以拆成三层，各占一个节点（Cocos 一个节点只能挂一个渲染组件）：

  · nine_base   白底不透明圆角矩形  → 由代码 tint 成任意底色
  · nine_gloss  白色半透明顶部高光  → 不染色，纯装饰
  · nine_stroke 深棕描边环（透明中心）→ 可 tint 成别的描边色

★ 九宫格正确性的关键约束（写错会出现「拉伸拖影」）：
  贴图被切成 9 块后，**中间横带/竖带/中心块会被拉伸**，因此这些区域必须沿拉伸方向是常量：
    · 中心块 (inset..W-inset, inset..H-inset) 四边都必须均匀；
    · 左/右竖带沿 y 必须均匀，上/下横带沿 x 必须均匀。
  所以高光带必须**完全落在上部横带内**（y < inset），不能伸进中间带，
  否则中间带里那几行高光会被纵向拉满整个面板。

输出：assets/resources/Textures/ui/nine_*.png
用法：<py> .workbuddy/tools/gen_nineslice.py [--out <目录>]
"""
import argparse
import os

from PIL import Image, ImageDraw

SS = 4  # 超采样倍率（先放大画再缩小，得到平滑边缘）

LINE = (74, 44, 20)  # #4A2C14 深棕描边（与 Theme.WOOD.line 一致）


def _rr(draw, box, radius, **kw):
    """圆角矩形（Pillow 的 rounded_rectangle，radius 已按 SS 放大）"""
    draw.rounded_rectangle(box, radius=radius, **kw)


def make_base(size, radius, inset):
    """白底不透明圆角矩形（可染色）"""
    W = size * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 留 0.5px 内缩，避免缩放后边缘发灰
    _rr(d, (0, 0, W - 1, W - 1), radius * SS, fill=(255, 255, 255, 255))
    return im.resize((size, size), Image.LANCZOS)


def make_gloss(size, radius, inset, alpha):
    """
    顶部高光：形状 = 圆角矩形的「顶盖」（上两角圆，下边平），
    ★ 整个形状必须落在 y < inset 的上部横带内，否则会被纵向拉伸成拖影。
    """
    W = size * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = 5
    cap_h = inset - pad - 2          # 高光带高度，收在上部横带里
    _rr(d, (pad * SS, pad * SS, W - pad * SS, (pad + cap_h) * SS),
        max(2, radius - 4) * SS, fill=(255, 255, 255, alpha))
    return im.resize((size, size), Image.LANCZOS)


def make_stroke(size, radius, inset, width):
    """描边环：只有外圈，中心透明（可染色）"""
    W = size * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    hw = width * SS / 2.0
    _rr(d, (hw, hw, W - hw, W - hw), radius * SS,
        outline=LINE + (255,), width=width * SS)
    return im.resize((size, size), Image.LANCZOS)


SPECS = [
    # 文件名,            画布, 圆角, 切边(inset), 说明
    ('nine_base',        128, 20, 26, 'base'),
    ('nine_gloss',       128, 20, 26, 'gloss'),
    ('nine_stroke',      128, 20, 26, 'stroke'),
    ('nine_chip',         96, 26, 27, 'base'),
    ('nine_chip_gloss',   96, 26, 27, 'gloss'),
    ('nine_chip_stroke',  96, 26, 27, 'stroke'),
]


def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument('--out', default=os.path.join(root, 'assets', 'resources', 'Textures', 'ui'))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    for name, size, radius, inset, kind in SPECS:
        if kind == 'base':
            im = make_base(size, radius, inset)
        elif kind == 'gloss':
            im = make_gloss(size, radius, inset, 46 if size == 128 else 30)
        else:
            im = make_stroke(size, radius, inset, 5 if size == 128 else 4)
        p = os.path.join(args.out, name + '.png')
        im.save(p)
        print('%-20s %dx%d  inset=%d  -> %s' % (name, size, size, inset, p))


if __name__ == '__main__':
    main()
