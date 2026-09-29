# -*- coding: utf-8 -*-
"""
贴图引用严格扫描（只读，不删任何文件）

判定口径（三线任一命中即算「在用」）：
  A. uuid 引用：assets 下 .scene/.prefab/.anim/.json/.fire + settings/profiles 里的
     "__uuid__": "X" / "X@sub" → 取 @ 前段命中贴图父 uuid。
  B. 登记清单：Core/Res.ts 里 'Textures/<rel>/spriteFrame' 形式（TEXTURE_PATHS）。
  C. 代码路径串：所有 .ts 里出现 'Textures/<rel>'、'<rel>'、'<rel 去一级前缀>' 精确串；
     仅 basename 命中记为「弱命中」（单独列出，人工复核）。

额外线索：
  D. 目录动态拼接：代码里出现 '<dir>/' + 变量、或 '<prefix>' + 变量 形式的动态路径，
     该目录整棵视作在用（列出被动态覆盖的目录）。

用法：<py> .workbuddy/tools/scan_tex_strict.py
输出：E:/.../_workbench/_tmp/tex_strict_report.txt（同时打印）
"""
import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
RES = os.path.join(ASSETS, 'resources')
SCRIPTS = os.path.join(ASSETS, 'Scripts')
TEX = os.path.join(RES, 'Textures')
RES_TS = os.path.join(SCRIPTS, 'Core', 'Res.ts')
OUT = os.path.join(os.path.dirname(ROOT), '..', '..', '_workbench', '_tmp', 'tex_strict_report.txt')
OUT = os.path.normpath(os.path.join(r'E:\LDC_Cocos_PJ\Cocos3X_2D\点瓶子_竖屏\_workbench\_tmp', 'tex_strict_report.txt'))

REF_EXT = ('.scene', '.prefab', '.anim', '.mtl', '.effect', '.json', '.fire', '.txt')


def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''


# ---------- 1) 贴图清单 ----------
texs = []          # (path, rel, uuid, size)
uuid2rel = {}
for r, _, fs in os.walk(TEX):
    for f in fs:
        if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        p = os.path.join(r, f)
        rel = os.path.relpath(p, RES).replace('\\', '/')          # Textures/ui/icon/coin.png
        key = os.path.relpath(p, TEX).replace('\\', '/')           # ui/icon/coin.png
        uid = ''
        meta = p + '.meta'
        if os.path.exists(meta):
            # ⚠️ 不能锚行首：部分 meta 的 uuid 缩进/排版不同（曾漏判 buco01 为「无 uuid」）
            m = re.search(r'"uuid"\s*:\s*"([0-9a-fA-F-]{20,})"', read(meta))
            if m:
                uid = m.group(1)
        texs.append((p, rel, key, uid, os.path.getsize(p)))
        if uid:
            uuid2rel[uid] = key

# assets 下 Textures 之外的图（单独列出，防止漏网）
other_tex = []
for r, _, fs in os.walk(ASSETS):
    if os.path.commonpath([os.path.normpath(r), os.path.normpath(TEX)]) == os.path.normpath(TEX):
        continue
    for f in fs:
        if f.lower().endswith(('.png', '.jpg', '.jpeg')):
            p = os.path.join(r, f)
            other_tex.append(os.path.relpath(p, ROOT).replace('\\', '/'))

# ---------- 2) A: uuid 引用 ----------
ref_uuids = set()
ref_where = {}
for r, _, fs in os.walk(ASSETS):
    for f in fs:
        if not f.lower().endswith(REF_EXT):
            continue
        p = os.path.join(r, f)
        for m in re.finditer(r'"__uuid__"\s*:\s*"([^"]+)"', read(p)):
            u = m.group(1).split('@')[0]
            ref_uuids.add(u)
            ref_where.setdefault(u, []).append(os.path.relpath(p, ROOT).replace('\\', '/'))
for extra in ('settings', 'profiles'):
    d = os.path.join(ROOT, extra)
    for r, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(r, f)
            for m in re.finditer(r'"__uuid__"\s*:\s*"([^"]+)"', read(p)):
                ref_uuids.add(m.group(1).split('@')[0])

# ---------- 3) B: Res.ts 登记 ----------
res_src = read(RES_TS)
reg = set(re.findall(r"'Textures/([^']+?)/spriteFrame'", res_src))

# ---------- 4) C: 代码路径串 ----------
code_strs = []
for r, _, fs in os.walk(SCRIPTS):
    for f in fs:
        if f.endswith('.ts'):
            code_strs.append(read(os.path.join(r, f)))
code_all = '\n'.join(code_strs)
literals = set()
for m in re.finditer(r"'([^'\n]{2,80})'", code_all):
    literals.add(m.group(1))
for m in re.finditer(r'"([^"\n]{2,80})"', code_all):
    literals.add(m.group(1))

# D: 动态拼接 → '<prefix>' + 变量 / `<prefix>${var}` / '<dir>/' + 变量
#    ⚠️ 前缀不要求以 '/' 结尾：'skin/tier/dik_' + n 这种也是动态加载（曾漏判导致误报死图）
dyn_prefixes = set()
for m in re.finditer(r"'([A-Za-z0-9_/]{2,48})'\s*\+", code_all):
    dyn_prefixes.add(m.group(1))
for m in re.finditer(r'`([A-Za-z0-9_/]{2,48})\$\{', code_all):
    dyn_prefixes.add(m.group(1))
dyn_dirs = dyn_prefixes


def lines_hit(rel_no_ext, key_no_ext):
    """C 线命中明细"""
    strong = []
    base = os.path.basename(key_no_ext)
    for lit in literals:
        l = lit
        if l in (rel_no_ext, key_no_ext):
            strong.append(l)
        elif l.startswith('Textures/') and l[len('Textures/'):] == key_no_ext:
            strong.append(l)
    if strong:
        return 'strong', sorted(set(strong))[:3]
    basehit = [l for l in literals if l == base]
    if basehit:
        return 'weak', basehit[:3]
    return 'none', []


lines = []
lines.append('=' * 78)
lines.append('贴图引用严格扫描（只读）  共 %d 张' % len(texs))
lines.append('=' * 78)

dead, weak, alive = [], [], []
for p, rel, key, uid, size in texs:
    key_no_ext = os.path.splitext(key)[0]
    rel_no_ext = os.path.splitext(rel)[0]
    hitA = bool(uid and uid in ref_uuids)
    hitB = key_no_ext in reg
    line, ev = lines_hit(rel_no_ext, key_no_ext)
    hitD = any(key_no_ext.startswith(d) for d in dyn_prefixes)
    tags = []
    if hitA:
        tags.append('A:uuid')
    if hitB:
        tags.append('B:Res登记')
    if line == 'strong':
        tags.append('C:代码路径')
    if line == 'weak':
        tags.append('C?仅文件名')
    if hitD:
        tags.append('D:目录动态前缀')
    rec = (rel, key, uid, size, tags, ev)
    if hitA or hitB or line == 'strong':
        alive.append(rec)
    elif line == 'weak' or hitD:
        weak.append(rec)
    else:
        dead.append(rec)

lines.append('')
lines.append('【判定】在用 %d / 待复核 %d / 疑似死图 %d' % (len(alive), len(weak), len(dead)))
lines.append('        死图合计 %.1f KB；待复核合计 %.1f KB' %
             (sum(d[3] for d in dead) / 1024, sum(d[3] for d in weak) / 1024))

# ★ 关键补充：只命中 B（Res.ts 预加载登记）、既无 uuid 引用也无代码路径串 —— 预加载白打，死图重点候选
only_b = [r for r in alive if r[4] == ['B:Res登记']]
lines.append('')
lines.append('-' * 78)
lines.append('■ ★仅预加载登记（B 线独有）：%d 张 / %.1f KB —— 无任何 prefab/scene/代码引用，删除时须同步删 Res.ts 清单'
             % (len(only_b), sum(r[3] for r in only_b) / 1024))
for rel, key, uid, size, tags, ev in sorted(only_b, key=lambda x: x[1]):
    lines.append('  %7.1f KB  %-46s uuid=%s' % (size / 1024, key, (uid or '-')[:8]))

# 仅 A（只有 uuid 引用，代码里找不到）：prefab/scene 烘焙在用，但代码可能已不再动态换图
only_a = [r for r in alive if r[4] == ['A:uuid']]
lines.append('')
lines.append('■ 仅 uuid 引用（A 线独有）：%d 张' % len(only_a))
for rel, key, uid, size, tags, ev in sorted(only_a, key=lambda x: x[1]):
    where = ref_where.get(uid, [])[:2]
    lines.append('  %7.1f KB  %-46s ← %s' % (size / 1024, key, ', '.join(where)))

lines.append('')
lines.append('-' * 78)
lines.append('■ 疑似死图（三线全不命中；按目录分组）')
by = {}
for rel, key, uid, size, tags, ev in dead:
    by.setdefault(os.path.dirname(key) or '.', []).append((key, size))
for d in sorted(by):
    items = sorted(by[d], key=lambda x: -x[1])
    lines.append('  [%s] %d 张 / %.1f KB' % (d, len(items), sum(i[1] for i in items) / 1024))
    for k, s in items:
        lines.append('     %7.1f KB  %s' % (s / 1024, k))

lines.append('')
lines.append('-' * 78)
lines.append('■ 待复核（仅文件名命中 或 落在动态拼接目录内）')
for rel, key, uid, size, tags, ev in sorted(weak, key=lambda x: x[1]):
    lines.append('  %7.1f KB  %-46s  %s %s' % (size / 1024, key, ','.join(tags), ev))

lines.append('')
lines.append('-' * 78)
lines.append('■ 动态拼接前缀（D 线，命中的目录视为整棵在用）')
for d in sorted(dyn_dirs):
    lines.append('  ' + d)

lines.append('')
lines.append('-' * 78)
lines.append('■ assets 下 Textures 之外的图（%d 张）' % len(other_tex))
for o in other_tex:
    lines.append('  ' + o)

report = '\n'.join(lines)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(report)
print(report)
