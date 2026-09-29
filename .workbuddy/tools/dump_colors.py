"""dump_colors.py <prefab 路径> —— 打印预制体里所有 Sprite/Label 的「名 + 贴图 + 颜色」。

用途：排查「XX 界面颜色太深/太浅」——直接看烘焙进预制体的 _color，
不用开编辑器逐个点。贴图 uuid 会在 assets 下找 .meta 解析成相对路径。

输出每行：<缩进><节点名>  tex=<相对路径或->  color=#RRGGBBAA  [Label 时附 string/size/color]
参数 --label 只打 Label；--sprite 只打 Sprite；默认都打。
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
flags = set(a for a in sys.argv[1:] if a.startswith('--'))
path = args[0]
only = 'all'
if '--label' in flags:
    only = 'label'
if '--sprite' in flags:
    only = 'sprite'

# ---- uuid -> 相对路径 ----
uuid2rel = {}
for dirpath, dirnames, filenames in os.walk(ASSETS):
    for fn in filenames:
        if not fn.endswith('.meta'):
            continue
        mp = os.path.join(dirpath, fn)
        try:
            txt = open(mp, 'r', encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        m = re.search(r'"uuid"\s*:\s*"([0-9a-fA-F-]{20,})"', txt)
        if m:
            uuid2rel[m.group(1)] = os.path.relpath(mp[:-5], ROOT).replace('\\', '/')

arr = json.load(open(path, 'r', encoding='utf-8'))


def hexof(c):
    if not c:
        return '-'
    r = int(c.get('r', 0)); g = int(c.get('g', 0)); b = int(c.get('b', 0)); a = int(c.get('a', 255))
    return '#%02X%02X%02X%02X' % (r, g, b, a)


def texof(v):
    if not v:
        return '-'
    if isinstance(v, dict):
        u = v.get('__uuid__')
    else:
        u = v
    if not u:
        return '-'
    base = u.split('@')[0]
    return uuid2rel.get(base, '?' + base[:8])


def walk(idx, depth, nameprefix=''):
    o = arr[idx]
    name = o.get('_name')
    full = nameprefix + '/' + name
    for c in o.get('_components', []):
        comp = arr[c['__id__']]
        t = comp.get('__type__', '?')
        if t == 'cc.Sprite' and only in ('all', 'sprite'):
            print('%-58s tex=%-46s color=%s size=%s' % (
                '  ' * depth + name, texof(comp.get('_spriteFrame')),
                hexof(comp.get('_color')), comp.get('_type')))
        if t == 'cc.Label' and only in ('all', 'label'):
            print('%-58s LABEL %-22r color=%s size=%s' % (
                '  ' * depth + name, comp.get('_string'),
                hexof(comp.get('_color')), comp.get('_fontSize')))
    for c in o.get('_children', []):
        walk(c['__id__'], depth + 1, full)


root = arr[1]
if root.get('__type__') == 'cc.Node':
    walk(1, 0)
else:
    walk(arr[0]['data']['__id__'], 0)
