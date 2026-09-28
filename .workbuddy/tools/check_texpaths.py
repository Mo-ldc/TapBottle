import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
res = open(os.path.join(ROOT,'assets/Scripts/Core/Res.ts'), encoding='utf-8').read()
paths = re.findall(r"'(Textures/[^']*)/spriteFrame'", res)
base = os.path.join(ROOT,'assets/resources')
missing = []
for p in paths:
    f = os.path.join(base, p + '.png')
    if not os.path.isfile(f):
        missing.append(p)
print('登记条数:', len(paths))
print('缺失张数:', len(missing))
for m in missing: print('  MISSING', m)
# 反向：目录里有但没登记的
have = set()
for dirpath, dirs, files in os.walk(os.path.join(base,'Textures')):
    for fn in files:
        if fn.endswith('.png'):
            rel = os.path.relpath(os.path.join(dirpath, fn), base).replace('\\','/')[:-4]
            have.add(rel)
regd = set(paths)
unreg = sorted(have - regd)
print('未登记贴图数:', len(unreg))
for u in unreg: print('  UNREG', u)
