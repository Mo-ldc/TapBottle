#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_nineslice_meta.py —— 给九宫格贴图的 .png.meta 写入九宫格边距。

Cocos Creator 3.x 的 SpriteFrame 九宫格边距存在贴图 meta 的
`subMetas.<spriteFrame id>.userData.borderTop/Bottom/Left/Right` 里。
必须先让编辑器导入一次（生成 meta），再打补丁，再刷新。

用法：<py> .workbuddy/tools/patch_nineslice_meta.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UI = os.path.join(ROOT, 'assets', 'resources', 'Textures', 'ui')

# 文件名 -> (left, right, top, bottom)，与 gen_nineslice.py 的 SPECS 保持一致
BORDERS = {
    'nine_base':        (26, 26, 26, 26),
    'nine_gloss':       (26, 26, 26, 26),
    'nine_stroke':      (26, 26, 26, 26),
    'nine_chip':        (27, 27, 27, 27),
    'nine_chip_gloss':  (27, 27, 27, 27),
    'nine_chip_stroke': (27, 27, 27, 27),
    # 引导层进度条填充：左端是圆头（跟着内槽圆角），右端被骑瓶压住是直边
    'boot_bar_fill':    (22, 6, 4, 4),
}


def patch(path, borders):
    with open(path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    subs = meta.get('subMetas', {})
    hit = 0
    for sid, sub in subs.items():
        if sub.get('importer') == 'sprite-frame':
            ud = sub.setdefault('userData', {})
            ud['borderLeft'], ud['borderRight'], ud['borderTop'], ud['borderBottom'] = borders
            hit += 1
    if not hit:
        return 'NO sprite-frame subMeta'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return 'ok (%d)' % hit


def main():
    for name, b in BORDERS.items():
        p = os.path.join(UI, name + '.png.meta')
        if not os.path.exists(p):
            print('%-20s MISSING meta (先让编辑器导入一次)' % name)
            continue
        print('%-20s %s' % (name, patch(p, b)))


if __name__ == '__main__':
    main()
