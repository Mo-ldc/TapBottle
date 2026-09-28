# -*- coding: utf-8 -*-
"""
隐藏态节点审计（只读，带代码用法上下文）

对场景/prefab 中每个 _active=false 的节点：
  - 打印它在 Scripts/*.ts 里出现的每一行（带文件名行号）；
  - 若出现处只有「置 false / 隐藏 / removeFromParent」→ 判 REMOVABLE（残留件）；
  - 若出现处有「置 true / addChild / 重新挂载」→ 判 KEEP（运行时还会用）。
另列出「无组件 & 无子节点的空壳」。
"""
import os
import re
import json

def read(p):
    try:
        return open(p, encoding='utf-8', errors='ignore').read()
    except Exception:
        return ''

src = {}          # name -> [(file, lineno, text)]
for r, _, fs in os.walk('assets/Scripts'):
    for f in fs:
        if not f.endswith('.ts'):
            continue
        p = os.path.join(r, f)
        for ln, line in enumerate(read(p).split('\n'), 1):
            for m in re.finditer(r"['\"]([A-Za-z_][A-Za-z0-9_]{1,30})['\"]", line):
                src.setdefault(m.group(1), []).append(
                    (os.path.relpath(p, 'assets/Scripts').replace('\\', '/'), ln, line.strip()[:150]))

REOPEN = re.compile(r'active\s*=\s*true|addChild|setSiblingIndex|\.insertChild|removeFromParent')
HIDEONLY = re.compile(r'active\s*=\s*false|removeFromParent|destroy')

files = []
for f in os.listdir('assets/scenes'):
    if f.endswith('.scene'):
        files.append('assets/scenes/' + f)
for r, _, fs in os.walk('assets/resources/Prefabs'):
    for f in fs:
        if f.endswith('.prefab'):
            files.append(os.path.join(r, f))

print('=' * 78)
print('隐藏态节点审计（只读）')
print('=' * 78)

for p in sorted(files):
    d = json.loads(read(p))
    nds = {i: o for i, o in enumerate(d) if isinstance(o, dict) and o.get('__type__') == 'cc.Node'}
    par = {}
    roots = set(nds)
    for i, o in nds.items():
        for c in o.get('_children', []):
            par[c['__id__']] = i
            roots.discard(c['__id__'])

    def path_of(i):
        segs, cur, g = [], i, 0
        while cur in nds and g < 40:
            segs.append(nds[cur].get('_name', '?'))
            cur = par.get(cur)
            g += 1
        return '/'.join(reversed(segs))

    rows = []
    for i, o in nds.items():
        nm = o.get('_name', '')
        comps = [d[c['__id__']].get('__type__', '') for c in o.get('_components', [])]
        kids = o.get('_children', [])
        if i in roots:
            continue
        if o.get('_active', True):
            continue
        uses = src.get(nm, [])
        reopen = any(REOPEN.search(t) for _, _, t in uses)
        rows.append((i, path_of(i), comps, len(kids), uses, reopen))
    if not rows:
        continue
    print('\n## ' + p)
    for i, pth, comps, nk, uses, reopen in rows:
        cs = ','.join([c for c in comps if 'PrefabInfo' not in c])
        print('  idx=%-5d %-46s kids=%-2d [%s]  %s' % (
            i, pth[-46:], nk, cs, 'KEEP(代码重开)' if reopen else ('REMOVABLE' if uses else 'REMOVABLE(代码零引用)')))
        for f, ln, t in uses[:4]:
            print('        %s:%d  %s' % (f, ln, t))
