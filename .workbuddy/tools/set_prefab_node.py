"""set_prefab_node.py <prefab 路径> <节点路径>:<x>,<y>[,<w>,<h>] ...

按**节点路径**（用 `/` 分隔，如 `btn/btnLb`）改写预制体里节点的 _lpos 与
UITransform._contentSize。用途：把「代码里的有效布局」一次性同步进 prefab，
腾出代码里的硬写坐标 —— 之后编辑器拖动的值就能直接生效。

只改数值，不动数组结构、不动 _id（手写 prefab 铁律：改结构要全量 remap）。

示例：
  python set_prefab_node.py assets/resources/Prefabs/UI/UpgradeRow.prefab \
      ic:-128,-6,40,40  tierBg:-128,-6  nameIc:-98,17  name:-98,17,316,60
"""
import json
import sys

path = sys.argv[1]
specs = [a for a in sys.argv[2:] if ':' in a]
arr = json.load(open(path, 'r', encoding='utf-8'))


def children(o):
    return [arr[c['__id__']] for c in o.get('_children', [])]


def find(root, segs):
    """按路径逐层找（同层重名取第一个）"""
    cur = root
    for s in segs:
        nxt = None
        for c in children(cur):
            if c.get('_name') == s:
                nxt = c
                break
        if nxt is None:
            return None
        cur = nxt
    return cur


def utrans(o):
    for c in o.get('_components', []):
        comp = arr[c['__id__']]
        if comp.get('__type__') == 'cc.UITransform':
            return comp
    return None


root = arr[1] if arr[1].get('__type__') == 'cc.Node' else arr[arr[0]['data']['__id__']]

def num(s):
    """整数就写整数 —— 编辑器写 prefab 用的是 int，写 40.0 会让下次保存多出一堆 diff"""
    f = float(s)
    return int(f) if f == int(f) else f


for s in specs:
    key, val = s.split(':', 1)
    nums = [num(x) for x in val.split(',') if x.strip() != '']
    node = find(root, key.split('/'))
    if node is None:
        print('[miss] %s' % key)
        continue
    changed = []
    if len(nums) >= 2:
        p = node.setdefault('_lpos', {'__type__': 'cc.Vec3'})
        if not p.get('__type__'):
            p['__type__'] = 'cc.Vec3'
        p['x'], p['y'], p['z'] = nums[0], nums[1], p.get('z', 0)
        changed.append('pos=(%s,%s)' % (nums[0], nums[1]))
    if len(nums) >= 4:
        ut = utrans(node)
        if ut is None:
            print('[no UITransform] %s' % key)
        else:
            ut['_contentSize'] = {'__type__': 'cc.Size', 'width': nums[2], 'height': nums[3]}
            changed.append('size=(%s,%s)' % (nums[2], nums[3]))
    print('[ok] %-16s %s' % (key, ' '.join(changed)))

json.dump(arr, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('--- written:', path)
