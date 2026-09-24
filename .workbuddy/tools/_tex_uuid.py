#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扫描 assets/resources 下的贴图 meta，生成「资源相对路径 → spriteFrame uuid」映射，
供手写 .prefab / .scene 引用贴图使用。

输出：.workbuddy/_tex_uuid.json
用法：python _tex_uuid.py [关键字...]     不带关键字则全表统计
"""
import glob
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RES = os.path.join(ROOT, 'assets', 'resources')
OUT = os.path.join(ROOT, '.workbuddy', '_tex_uuid.json')


def build():
    m = {}
    pats = ['**/*.png.meta', '**/*.jpg.meta', '**/*.jpeg.meta', '**/*.webp.meta']
    pats = [os.path.join(RES, p) for p in pats]
    seen = set()
    for pat in pats:
        for p in glob.glob(pat, recursive=True):
            if p in seen:
                continue
            seen.add(p)
            try:
                d = json.load(open(p, encoding='utf-8'))
            except Exception:
                continue
            u = d.get('uuid')
            if not u:
                continue
            rel = os.path.relpath(p[: -len('.meta')], RES).replace(os.sep, '/')
            rel = rel.rsplit('.', 1)[0]   # 去掉扩展名：Textures/ui/coin.png → Textures/ui/coin
            # 命中和 imperfections: 贴图 meta 里 spriteFrame 子资源的 uuid 就是 "<uuid>@f9941"
            m[rel] = u + '@f9941'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(m, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return m


if __name__ == '__main__':
    m = build()
    print(len(m), 'textures ->', OUT)
    for kw in sys.argv[1:]:
        print('  %-24s %s' % (kw, m.get(kw, 'MISSING')))
    if len(sys.argv) == 1:
        for k in sorted(m)[:8]:
            print('  %-24s %s' % (k, m[k]))
