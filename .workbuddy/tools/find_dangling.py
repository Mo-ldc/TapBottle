# -*- coding: utf-8 -*-
"""
找出 .prefab / .scene 里的「悬空资源引用」——即 __uuid__ 指向当前 assets 中不存在的资源。
并把悬空 uuid 反查到原始资源路径（先在 assets 里找，再去 unused_park / 各备份目录找）。

用法：<py> .workbuddy/tools/find_dangling.py
输出：.workbuddy/tmp/dangling.txt
"""
import os
import re
import json
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
TMP = os.path.join(ROOT, '.workbuddy', 'tmp')
sys.stdout.reconfigure(encoding='utf-8')

# ---------- 1) 当前存在的资源 uuid（含子资源 uuid） ----------
alive = {}   # uuid -> path
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if not f.endswith('.meta'):
            continue
        p = os.path.join(root, f)
        try:
            s = open(p, encoding='utf-8', errors='ignore').read()
        except Exception:
            continue
        target = p[:-5]  # 去掉 .meta
        # 目录 meta
        for m in re.finditer(r'"uuid"\s*:\s*"([0-9a-fA-F-]+)"', s):
            alive[m.group(1)] = target
            alive[m.group(1).split('@')[0]] = target

# ---------- 2) 备份区 uuid 索引（用于反查被移走/删除的资源原名） ----------
bak_index = {}
for sub in ('unused_park', 'dead_res_bak', 'texture_src', 'skin_bak', 'reorg_bak',
            'prefab_bak', 'scene_bak'):
    d = os.path.join(ROOT, '.workbuddy', sub)
    if not os.path.isdir(d):
        continue
    for root, _, fs in os.walk(d):
        for f in fs:
            if not f.endswith('.meta'):
                continue
            p = os.path.join(root, f)
            try:
                s = open(p, encoding='utf-8', errors='ignore').read()
            except Exception:
                continue
            for m in re.finditer(r'"uuid"\s*:\s*"([0-9a-fA-F-]+)"', s):
                bak_index[m.group(1)] = os.path.relpath(p[:-5], ROOT).replace('\\', '/')
                bak_index[m.group(1).split('@')[0]] = os.path.relpath(p[:-5], ROOT).replace('\\', '/')

# ---------- 3) 扫 prefab / scene 的所有引用 ----------
def node_of_obj(arr, comp_id):
    """找到包含组件 id 的节点（节点._components 里有该 __id__）"""
    for o in arr:
        if isinstance(o, dict) and o.get('__type__') == 'cc.Node':
            comps = o.get('_components') or []
            for c in comps:
                if isinstance(c, dict) and c.get('__id__') == comp_id:
                    return o.get('_name')
    return None


def comp_type(arr, comp_id):
    if 0 <= comp_id < len(arr):
        o = arr[comp_id]
        if isinstance(o, dict):
            return o.get('__type__')
    return None


def sprite_name_of(arr, comp_id):
    """对有 _spriteFrame 的组件，取它自身节点的名字"""
    return None


results = []
targets = []
for root, _, fs in os.walk(ASSETS):
    for f in fs:
        if f.endswith(('.prefab', '.scene', '.anim')):
            targets.append(os.path.join(root, f))

for p in targets:
    try:
        arr = json.load(open(p, encoding='utf-8'))
    except Exception as e:
        print('  解析失败', p, e)
        continue
    if not isinstance(arr, list):
        continue
    for i, o in enumerate(arr):
        if not isinstance(o, dict):
            continue
        for k, v in o.items():
            if not isinstance(v, dict) or '__uuid__' not in v:
                continue
            u = str(v['__uuid__']).split('@')[0]
            if not u or u in alive:
                continue
            results.append({
                'file': os.path.relpath(p, ROOT).replace('\\', '/'),
                'field': k,
                'comp_type': o.get('__type__'),
                'comp_id': i,
                'node': node_of_obj(arr, i) or o.get('_name') or '',
                'uuid': u,
                'origin': bak_index.get(u, ''),
            })

# ---------- 4) 输出 ----------
L = []
L.append('=' * 78)
L.append('悬空资源引用（prefab/scene/anim 指向不存在的 uuid）')
L.append('  文件数 %d，悬空引用 %d 处' % (len(set(r['file'] for r in results)), len(results)))
L.append('=' * 78)
cur = None
for r in sorted(results, key=lambda x: (x['file'], x['node'])):
    if r['file'] != cur:
        cur = r['file']
        L.append('')
        L.append('### %s' % cur)
    L.append('   [%s] 节点=%-24s 字段=%-14s uuid=%s' % (
        r['comp_type'], r['node'][:24], r['field'], r['uuid'][:12]))
    L.append('        原资源: %s' % (r['origin'] or '★ 未知（不在任何备份里）'))

out = '\n'.join(L)
os.makedirs(TMP, exist_ok=True)
open(os.path.join(TMP, 'dangling.txt'), 'w', encoding='utf-8').write(out)
print(out)
json.dump(results, open(os.path.join(TMP, 'dangling.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
