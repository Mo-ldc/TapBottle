# -*- coding: utf-8 -*-
"""
图片资源「在用/无用」独立复核（只读，不删任何文件）

与 scan_unused.py 的区别：本脚本对**每一张图片**输出三条独立证据，供人工审视，
不做「命中任一即算在用」的黑箱合并判定。

三条证据：
  E1 uuid    : 该图（及其 meta 子资源 uuid）是否被 .scene/.prefab/.anim/.mtl/.effect/.json
               或 settings/profiles/build-templates 里的 __uuid__ 引用
  E2 path    : 该图的 resources 相对路径（多种写法）是否作为字符串字面量出现在
               assets/**/*.ts 里（CC 构建器靠脚本字符串字面量收集资源依赖）
  E3 name    : 该图 basename 是否出现在任意文本文件内容里（兜底，防动态拼接）

用法：<py> .workbuddy/tools/verify_unused.py
输出：.workbuddy/tmp/verify_unused.txt （同时打印）
"""
import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
RES = os.path.join(ASSETS, 'resources')
TMP = os.path.join(ROOT, '.workbuddy', 'tmp')
IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp')

TEXT_EXT = ('.ts', '.js', '.scene', '.prefab', '.anim', '.mtl', '.effect', '.json',
            '.fire', '.txt', '.html', '.md', '.tpl', '.csv', '.xml')


def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''


# ---------- 1) 全部图片 + uuid ----------
imgs = []
uuid2img = {}
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if not f.lower().endswith(IMG_EXT):
            continue
        p = os.path.join(root, f)
        meta = p + '.meta'
        uid = ''
        sub_uids = []
        if os.path.exists(meta):
            src = read(meta)
            m = re.search(r'^\s*"uuid"\s*:\s*"([0-9a-fA-F-]+)"', src, re.M)
            if m:
                uid = m.group(1)
            for mm in re.finditer(r'"(?:uuid)"\s*:\s*"([0-9a-fA-F-]+)@', src):
                sub_uids.append(mm.group(1))
        imgs.append({'path': p, 'rel': os.path.relpath(p, ROOT).replace('\\', '/'),
                     'uuid': uid, 'sub': sub_uids, 'size': os.path.getsize(p)})
        for u in [uid] + sub_uids:
            if u:
                uuid2img.setdefault(u, p)

# ---------- 2) 收集引用 uuid ----------
ref_uuids = set()
ref_sources = {}
scan_dirs = [ASSETS, os.path.join(ROOT, 'settings'), os.path.join(ROOT, 'profiles'),
             os.path.join(ROOT, 'build-templates')]
for d in scan_dirs:
    if not os.path.isdir(d):
        continue
    for root, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(root, f)
            if f.endswith('.meta'):
                continue
            if not f.lower().endswith(TEXT_EXT):
                continue
            src = read(p)
            for m in re.finditer(r'"__uuid__"\s*:\s*"([^"]+)"', src):
                u = m.group(1).split('@')[0]
                ref_uuids.add(u)
                # 只记录资源类来源文件（scene/prefab/anim/mtl/json），ts 单独看
                if not p.endswith('.ts'):
                    ref_sources.setdefault(u, set()).add(
                        os.path.relpath(p, ROOT).replace('\\', '/'))

# ---------- 3) 脚本里的路径字符串 ----------
ts_files = []
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if f.endswith('.ts'):
            ts_files.append(os.path.join(root, f))
ts_src = {p: read(p) for p in ts_files}
ts_all = '\n'.join(ts_src.values())

# 所有文本文件内容（兜底 name 检查用，排除 meta 与图片自身）
all_text = {}
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if f.endswith('.meta'):
            continue
        if f.lower().endswith(TEXT_EXT):
            p = os.path.join(root, f)
            all_text[p] = read(p)
blob = '\n'.join(all_text.values())

# ---------- 4) 逐图判定 ----------
rows = []
for it in imgs:
    rel_res = ''
    if it['path'].startswith(RES):
        rel_res = os.path.relpath(it['path'], RES).replace('\\', '/')
    base = os.path.splitext(os.path.basename(it['path']))[0]

    # E1
    e1 = False
    e1_where = ''
    if it['uuid']:
        u1 = it['uuid']
        u2 = it['sub'][0] if it['sub'] else ''
        if u1 in ref_uuids or (u2 and u2 in ref_uuids):
            e1 = True
            srcs = ref_sources.get(u2) or ref_sources.get(u1) or set()
            e1_where = ','.join(sorted(srcs)[:3])

    # E2 路径字面量
    e2 = False
    e2_where = ''
    if rel_res:
        no_ext = os.path.splitext(rel_res)[0]
        cands = {rel_res, no_ext}
        # 去掉一级前缀的写法（代码里常写 'Textures/xxx' 而不是 resources 相对全路径）
        parts = no_ext.split('/')
        for i in range(len(parts)):
            cands.add('/'.join(parts[i:]))
        for c in sorted(cands, key=len, reverse=True):
            if len(c) < 4:
                continue
            if ("'" + c + "'") in ts_all or ('"' + c + '"') in ts_all \
               or ("'" + c + "/spriteFrame'") in ts_all:
                e2 = True
                e2_where = c
                break

    # E3 basename 兜底（排除图片自己所在文件、排除 meta）
    e3 = False
    e3_where = ''
    if len(base) >= 4:
        pat = re.compile(r'(?<![A-Za-z0-9_])' + re.escape(base) + r'(?![A-Za-z0-9_])')
        for p, s in all_text.items():
            if p == it['path']:
                continue
            if pat.search(s):
                e3 = True
                e3_where = os.path.relpath(p, ROOT).replace('\\', '/')
                break

    alive = e1 or e2 or e3
    rows.append((it, alive, e1, e1_where, e2, e2_where, e3, e3_where))

dead = [(r[0], r) for r in rows if not r[1]]
alive = [r for r in rows if r[1]]

# ---------- 5) 输出 ----------
L = []
L.append('=' * 78)
L.append('图片资源独立复核（只读）')
L.append('  图片总数 %d : 判定在用 %d / 判定无用 %d' % (len(imgs), len(alive), len(dead)))
L.append('  无用合计 %.3f MB' % (sum(r[0]['size'] for r in dead) / 1048576))
L.append('=' * 78)
L.append('')
L.append('【判定无用 %d 张】' % len(dead))
for it, r in sorted(dead, key=lambda x: x[0]['rel']):
    L.append('  %8.1f KB  %s' % (it['size'] / 1024, it['rel']))
    L.append('              uuid=%s' % (it['uuid'] or '(无 meta)'))
L.append('')
L.append('-' * 78)
L.append('【判定在用 %d 张】（列出命中证据，供抽查）' % len(alive))
for it, a, e1, w1, e2, w2, e3, w3 in sorted(alive, key=lambda x: x[0]['rel']):
    tags = []
    if e1:
        tags.append('uuid<-' + (w1 or '?'))
    if e2:
        tags.append("path='" + w2 + "'")
    if e3:
        tags.append('name~' + w3)
    L.append('  %s' % it['rel'])
    L.append('      ' + ' | '.join(tags))

out = '\n'.join(L)
os.makedirs(TMP, exist_ok=True)
open(os.path.join(TMP, 'verify_unused.txt'), 'w', encoding='utf-8').write(out)
json.dump({'dead': [{'rel': it['rel'], 'size': it['size'], 'uuid': it['uuid'],
                     'sub': it['sub']} for it, _ in dead]},
          open(os.path.join(TMP, 'verify_unused.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\n'.join(L[:60]))
print('...')
print('full report ->', os.path.join(TMP, 'verify_unused.txt'))
