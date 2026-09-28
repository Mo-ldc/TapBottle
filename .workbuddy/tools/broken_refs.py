# -*- coding: utf-8 -*-
"""
失效引用诊断：把「git HEAD 时的资源」与「当前工作树」做交叉比对，找出所有指向
已删除资源的引用（prefab/scene 的 __uuid__，以及代码里的资源路径字面量）。

用法：<py> .workbuddy/tools/broken_refs.py
输出：.workbuddy/tmp/broken_refs.txt
"""
import os
import re
import json
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
HEAD = os.path.join(ROOT, '.workbuddy', 'tmp', 'head_snap', 'assets')
TMP = os.path.join(ROOT, '.workbuddy', 'tmp')
sys.stdout.reconfigure(encoding='utf-8')


def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''


def uuid_index(base):
    """扫描某目录树下所有 .meta，返回 uuid -> 资源相对路径（去掉 base 前缀）"""
    idx = {}
    for root, _, fs in os.walk(base):
        for f in fs:
            if not f.endswith('.meta'):
                continue
            p = os.path.join(root, f)
            target = p[:-5]
            rel = os.path.relpath(target, base).replace('\\', '/')
            for m in re.finditer(r'"uuid"\s*:\s*"([0-9a-fA-F-]+)"', read(p)):
                u = m.group(1)
                idx[u] = rel
                idx[u.split('@')[0]] = rel
    return idx


head_idx = uuid_index(HEAD)          # HEAD 时存在的 uuid
now_idx = uuid_index(ASSETS)         # 当前存在的 uuid

# 已删除资源：HEAD 有、现在无
removed = {}
for u, rel in head_idx.items():
    if u not in now_idx and '@' not in u:
        removed[u] = rel
# 子资源 uuid 也登记（悬空引用常指向 spriteFrame 子 uuid）
removed_all = {}
for u, rel in head_idx.items():
    if u not in now_idx:
        removed_all[u] = rel

# ---------- A. prefab / scene 悬空 uuid ----------
def node_of(arr, comp_id):
    for o in arr:
        if isinstance(o, dict) and o.get('__type__') == 'cc.Node':
            for c in (o.get('_components') or []):
                if isinstance(c, dict) and c.get('__id__') == comp_id:
                    return o.get('_name')
    return None


dangling = []
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if not f.endswith(('.prefab', '.scene', '.anim')):
            continue
        p = os.path.join(root, f)
        try:
            arr = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        if not isinstance(arr, list):
            continue
        for i, o in enumerate(arr):
            if not isinstance(o, dict):
                continue
            for k, v in o.items():
                if not isinstance(v, dict) or '__uuid__' not in v:
                    continue
                u = str(v['__uuid__'])
                if u in now_idx or u.split('@')[0] in now_idx:
                    continue
                dangling.append({
                    'file': os.path.relpath(p, ROOT).replace('\\', '/'),
                    'node': node_of(arr, i) or '',
                    'comp': o.get('__type__'),
                    'field': k,
                    'uuid': u,
                    'origin': removed_all.get(u) or head_idx.get(u, ''),
                })

# ---------- B. 代码里的资源路径字面量是否还存在 ----------
now_paths = set()
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if f.endswith('.meta'):
            continue
        now_paths.add(os.path.relpath(os.path.join(root, f), ASSETS).replace('\\', '/'))
# 也允许 resources 相对写法（res/ 前缀）
res_paths = set()
for p in now_paths:
    if p.startswith('resources/'):
        res_paths.add(p[len('resources/'):])
        res_paths.add(os.path.splitext(p[len('resources/'):])[0])

bad_code = []
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if not f.endswith('.ts'):
            continue
        p = os.path.join(root, f)
        src = read(p)
        for m in re.finditer(r"'((?:Textures|Audio|Fonts|Prefabs|Text)[^']*)'", src):
            cand = m.group(1)
            # 去掉 /spriteFrame 后缀
            cand2 = re.sub(r'/(spriteFrame)$', '', cand)
            if cand2 in res_paths or (cand2 + '.png') in res_paths \
               or (cand2 + '.mp3') in res_paths or (cand2 + '.ttf') in res_paths \
               or (cand2 + '.prefab') in res_paths or (cand2 + '.json') in res_paths:
                continue
            # 前缀式（目录动态加载）放过
            line = src[:m.start()].count('\n') + 1
            bad_code.append({
                'file': os.path.relpath(p, ROOT).replace('\\', '/'),
                'line': line, 'path': cand,
            })

# ---------- 输出 ----------
L = []
L.append('=' * 80)
L.append('失效引用诊断')
L.append('  HEAD 资源 %d 项 / 当前 %d 项' % (
    len(set(v for k, v in head_idx.items() if '@' not in k)),
    len(set(v for k, v in now_idx.items() if '@' not in k))))
L.append('  已删除(uuid 全丢) %d 项 | prefab/scene 悬空引用 %d 处 | 代码路径失效 %d 处'
         % (len(set(removed_all.values())), len(dangling), len(bad_code)))
L.append('=' * 80)

L.append('')
L.append('【A. prefab/scene 里指向已删除资源的引用】')
if not dangling:
    L.append('   （无）')
for d in sorted(dangling, key=lambda x: (x['file'], x['node'])):
    L.append('  %s' % d['file'])
    L.append('      节点=%s  组件=%s  字段=%s' % (d['node'], d['comp'], d['field']))
    L.append('      原资源=%s' % (d['origin'] or '?'))

L.append('')
L.append('【B. 代码里失效的资源路径字面量】')
if not bad_code:
    L.append('   （无）')
for b in sorted(bad_code, key=lambda x: (x['file'], x['line'])):
    L.append('  %s:%d   %s' % (b['file'], b['line'], b['path']))

L.append('')
L.append('【C. 已删除资源清单（HEAD 有、现在无）】')
by_dir = {}
for u, rel in removed_all.items():
    if '@' in u:
        continue
    by_dir.setdefault(os.path.dirname(rel) or '.', []).append(os.path.basename(rel))
for d in sorted(by_dir):
    L.append('  %s/  (%d): %s' % (d, len(by_dir[d]), ', '.join(sorted(by_dir[d]))))

out = '\n'.join(L)
os.makedirs(TMP, exist_ok=True)
open(os.path.join(TMP, 'broken_refs.txt'), 'w', encoding='utf-8').write(out)
print(out)
