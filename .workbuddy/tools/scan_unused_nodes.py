# -*- coding: utf-8 -*-
"""
节点无用性扫描（只读）：场景 + prefab 里疑似「已经用不到」的节点。

判定线索（全部列出，人工复核后再删）：
  A. 节点名、或其整棵子树节点名，在 Scripts/*.ts 的字符串池里完全找不到；
  B. 节点/子树所有渲染组件都不活跃（_active=false，含被换皮后遗留的 gloss/stroke/posts 等拼装件）；
  C. 空壳：无任何组件（或只有 UITransform）且无子节点，且名不在代码池里。
输出：文件 / 节点路径 / 尺寸 / 组件 / 命中线索 / 体积影响（节点数）
用法：<py> .workbuddy/tools/scan_unused_nodes.py [--json out.json]
"""
import os
import re
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'assets')
SCRIPTS = os.path.join(ASSETS, 'Scripts')
SCENES = os.path.join(ASSETS, 'scenes')

# 裸名组件（非 cc.* ，即项目脚本）视为「有逻辑」→ 其所在节点/父链保守保留
RENDER = {'cc.Sprite', 'cc.Label', 'cc.Graphics', 'cc.Mask', 'cc.RichText',
          'cc.ParticleSystem2D', 'cc.Animation', 'cc.Button'}


def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''


# ---------- 1) 代码字符串池 ----------
names = set()
prefixes = set()
for root, _, fs in os.walk(SCRIPTS):
    for f in fs:
        if not f.endswith('.ts'):
            continue
        s = read(os.path.join(root, f))
        for m in re.finditer(r"'([^'\n]{1,40})'", s):
            names.add(m.group(1))
        for m in re.finditer(r'"([^"\n]{1,40})"', s):
            names.add(m.group(1))
        # 动态拼接前缀，如 'it' + i / 'row' + idx
        for m in re.finditer(r"'([A-Za-z_]{2,12})'\s*\+", s):
            prefixes.add(m.group(1))
        for m in re.finditer(r"'([A-Za-z_]{2,12})_'?\s*\+", s):
            prefixes.add(m.group(1))


def in_pool(name: str) -> bool:
    if not name:
        return True
    if name in names:
        return True
    for p in prefixes:
        if name.startswith(p):
            return True
    # 常见系统名（编辑器/引擎生成）
    if name in ('Canvas', 'Camera', 'Scene', 'Main Camera', 'UICamera'):
        return True
    return False


# ---------- 2) 遍历序列化文件 ----------
report = []


def load(p):
    d = json.loads(read(p))
    return d


def nodes_of(d):
    """返回 [(idx, node)]"""
    out = []
    for i, o in enumerate(d):
        if isinstance(o, dict) and o.get('__type__') == 'cc.Node':
            out.append((i, o))
    return out


def children_names(d, o):
    return [d[c['__id__']].get('_name', '?') for c in o.get('_children', [])]


def comp_types(d, o):
    out = []
    for c in o.get('_components', []):
        out.append(d[c['__id__']].get('__type__', '?'))
    return out


def scan_file(path):
    d = load(path)
    nodes = nodes_of(d)
    idx2node = {i: o for i, o in nodes}
    # 父链
    parent = {}
    for i, o in nodes:
        for c in o.get('_children', []):
            parent[c['__id__']] = i

    def path_of(i):
        segs = []
        cur = i
        seen = 0
        while cur in idx2node and seen < 40:
            segs.append(idx2node[cur].get('_name', '?'))
            cur = parent.get(cur)
            seen += 1
        return '/'.join(reversed(segs))

    def subtree(i, acc):
        acc.append(i)
        for c in idx2node[i].get('_children', []):
            j = c['__id__']
            if j in idx2node:
                subtree(j, acc)
        return acc

    # 有项目脚本组件的节点 → 保留整条父链
    keep = set()
    for i, o in nodes:
        for t in comp_types(d, o):
            if not t.startswith('cc.') and 'PrefabInfo' not in t:
                cur = i
                guard = 0
                while cur is not None and guard < 60:
                    keep.add(cur)
                    cur = parent.get(cur)
                    guard += 1
                break

    for i, o in nodes:
        acc = subtree(i, [])
        # 线索 A：整棵子树名字都不在池里
        name_hit = any(in_pool(idx2node[j].get('_name', '')) for j in acc)
        # 线索 B：子树里没有任何 render 组件是 active 的
        any_render_active = False
        for j in acc:
            nj = idx2node[j]
            act = nj.get('_active', True)
            for t in comp_types(d, nj):
                if t in RENDER and act:
                    any_render_active = True
        # 线索 C：空壳
        shell = (len(comp_types(d, o)) <= 1) and not o.get('_children')
        clues = []
        if not name_hit and not shell:
            clues.append('A:名字不在代码池')
        if not any_render_active:
            clues.append('B:渲染全隐藏')
        if shell and not name_hit:
            clues.append('C:空壳无引用')
        if not clues:
            continue
        if i in keep and 'A:名字不在代码池' not in clues:
            continue
        if i in keep:
            clues.append('(父链挂了项目脚本)')
        report.append({
            'file': os.path.relpath(path, ROOT).replace('\\', '/'),
            'idx': i,
            'path': path_of(i),
            'name': o.get('_name'),
            'active': o.get('_active', True),
            'kids': len(acc) - 1,
            'comps': [t for t in comp_types(d, o) if 'PrefabInfo' not in t],
            'clues': clues,
        })


files = [os.path.join(SCENES, f) for f in os.listdir(SCENES) if f.endswith('.scene')]
pfroot = os.path.join(ASSETS, 'resources', 'Prefabs')
for root, _, fs in os.walk(pfroot):
    files += [os.path.join(root, f) for f in fs if f.endswith('.prefab')]

for p in sorted(files):
    scan_file(p)

print('=' * 70)
print('节点无用性扫描（只读）  候选 %d 个' % len(report))
print('=' * 70)
cur = None
for r in sorted(report, key=lambda x: (x['file'], x['path'])):
    if r['file'] != cur:
        cur = r['file']
        print('\n## ' + cur)
    print('  idx=%-5d %-58s kids=%-3d [%s]  %s' % (
        r['idx'], r['path'][-58:], r['kids'], ','.join(r['comps']), ' '.join(r['clues'])))

if '--json' in sys.argv:
    out = sys.argv[sys.argv.index('--json') + 1]
    json.dump(report, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('\njson -> ' + out)
