"""dump_prefab.py <prefab 路径> —— 打印预制体节点树（名/坐标/尺寸/组件类型）。
用途：排查「编辑器里改了位置，游戏里没生效」——把这份「预制体真相」与无头
运行期 dump 出的节点坐标做 diff，就能定位是哪段代码在覆盖。
"""
import json
import sys

path = sys.argv[1]
arr = json.load(open(path, 'r', encoding='utf-8'))

def size(o):
    for c in o.get('_components', []):
        comp = arr[c['__id__']]
        if comp.get('__type__') == 'cc.UITransform':
            return '%sx%s' % (comp.get('_contentSize', {}).get('width'), comp.get('_contentSize', {}).get('height'))
    return '-'

def comps(o):
    names = []
    for c in o.get('_components', []):
        t = arr[c['__id__']].get('__type__', '?')
        names.append(t.replace('cc.', ''))
    return ','.join(names)

def walk(idx, depth):
    o = arr[idx]
    p = o.get('_lpos') or {}
    print('%s%-26s pos=(%s,%s) size=%s  [%s]' % (
        '  ' * depth, o.get('_name'),
        round(p.get('x', 0), 1) if p else 0,
        round(p.get('y', 0), 1) if p else 0,
        size(o), comps(o)))
    for c in o.get('_children', []):
        walk(c['__id__'], depth + 1)

root = arr[1]
if root.get('__type__') == 'cc.Node':
    walk(1, 0)
else:
    # prefab：arr[0]=cc.Prefab(data=arr[1])
    walk(arr[0]['data']['__id__'], 0)
print('--- 顶层类型 ---', arr[0].get('__type__'))
