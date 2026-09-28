import os, re, json, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uuid2path = {}
for dirpath, dirs, files in os.walk(os.path.join(ROOT,'assets')):
    for fn in files:
        if not fn.endswith('.meta'): continue
        p = os.path.join(dirpath, fn)
        try: j = json.load(open(p, encoding='utf-8'))
        except Exception: continue
        u = j.get('uuid')
        if not u: continue
        rel = os.path.relpath(p, ROOT).replace('\\','/')[:-5]
        uuid2path[u] = rel
        for k, sm in (j.get('subMetas') or {}).items():
            if isinstance(sm, dict) and sm.get('uuid'):
                uuid2path[sm['uuid']] = rel + ' ::' + k
target = sys.argv[1]
j = json.load(open(os.path.join(ROOT, target), encoding='utf-8'))
refs = collections.Counter()
def walk(o):
    if isinstance(o, dict):
        if isinstance(o.get('__uuid__'), str): refs[o['__uuid__']] += 1
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(j)
print('对象数:', len(j), '不同 uuid:', len(refs))
unknown = [(u,c) for u,c in refs.items() if u not in uuid2path]
print('未找到:', len(unknown))
for u,c in sorted(unknown, key=lambda x:-x[1]): print('  UNKNOWN', u, c)
print('--- 已找到的（贴图资源） ---')
for u,c in sorted(refs.items(), key=lambda x:-x[1]):
    if u in uuid2path and '.png' in uuid2path[u]:
        print('  %-3d %s' % (c, uuid2path[u]))
