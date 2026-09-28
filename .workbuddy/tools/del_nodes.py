# -*- coding: utf-8 -*-
"""
安全删除 .scene / .prefab 序列化数组中的节点（含整棵子树 + 组件 + PrefabInfo），
并对数组做完整的 __id__ remap。

安全性：
  1. 自动收集：指定节点 + 全部后代节点 + 各自的组件 + 组件的 __prefab(CompPrefabInfo)
     + 节点的 _prefab(PrefabInfo)。
  2. 删除前校验：保留集合中任何对象的任何 __id__ 引用都不允许指向删除集合
     （父节点 _children 中的待删条目会先移除）；发现外部引用 → 报错中止，不写文件。
  3. 原文件备份到 .workbuddy/node_bak/（带时间戳）。
用法：<py> del_nodes.py <file.json> <idx1,idx2,...> [file2 idx...]   （idx 传节点下标，后代自动带上）
"""
import os
import re
import sys
import json
import shutil
import time


def collect(arr, roots):
    """roots: 节点 idx 集合 → 返回完整删除集合（节点+组件+prefabinfo）"""
    nodes = {i: o for i, o in enumerate(arr)
             if isinstance(o, dict) and o.get('__type__') == 'cc.Node'}
    del_nodes = set()

    def add_sub(i):
        if i in del_nodes or i not in nodes:
            return
        del_nodes.add(i)
        for c in nodes[i].get('_children', []):
            add_sub(c['__id__'])

    for r in roots:
        add_sub(r)

    D = set(del_nodes)
    for i in del_nodes:
        o = nodes[i]
        for c in o.get('_components', []):
            j = c['__id__']
            comp = arr[j]
            if not isinstance(comp, dict):
                continue
            D.add(j)
            pf = comp.get('__prefab')
            if isinstance(pf, dict) and '__id__' in pf:
                D.add(pf['__id__'])
        pr = o.get('_prefab')
        if isinstance(pr, dict) and '__id__' in pr:
            D.add(pr['__id__'])
    return D, del_nodes


def ids_in(obj, out):
    """递归收集对象里所有 {'__id__': n} 引用"""
    if isinstance(obj, dict):
        if '__id__' in obj and isinstance(obj['__id__'], int):
            out.append(obj['__id__'])
        for v in obj.values():
            ids_in(v, out)
    elif isinstance(obj, list):
        for v in obj:
            ids_in(v, out)


def remap_ids(obj, mp):
    if isinstance(obj, dict):
        if '__id__' in obj and isinstance(obj['__id__'], int) and obj['__id__'] in mp:
            obj['__id__'] = mp[obj['__id__']]
        for v in obj.values():
            remap_ids(v, mp)
    elif isinstance(obj, list):
        for v in obj:
            remap_ids(v, mp)


def process(path, roots):
    raw = open(path, encoding='utf8').read()
    indent = 2 if raw.startswith('{\n  ') else None
    arr = json.loads(raw)
    D, del_nodes = collect(arr, roots)

    # 保留集合的外部引用校验
    keep = [i for i in range(len(arr)) if i not in D]
    bad = []
    for i in keep:
        refs = []
        ids_in(arr[i], refs)
        for r in refs:
            if r in D and not (i in D):
                # 父节点 _children 引用待删子节点 → 稍后移除，合法
                oi = arr[i]
                is_child_ref = False
                if isinstance(oi, dict) and oi.get('__type__') == 'cc.Node':
                    for c in oi.get('_children', []):
                        if c['__id__'] == r:
                            is_child_ref = True
                if not is_child_ref:
                    bad.append((i, arr[i].get('__type__', '?'), arr[i].get('_name', ''), r))
    if bad:
        print('!! 外部引用指向删除集合，中止：')
        for i, t, nm, r in bad[:10]:
            print('   keep[%d] %s %s -> del %d' % (i, t, nm, r))
        sys.exit(2)

    # 父节点 _children 移除待删条目
    for i in keep:
        oi = arr[i]
        if isinstance(oi, dict) and oi.get('__type__') == 'cc.Node':
            ch = oi.get('_children')
            if ch:
                oi['_children'] = [c for c in ch if c['__id__'] not in D]

    # 重建 + remap
    new_arr = [arr[i] for i in keep]
    mp = {old: new for new, old in enumerate(keep)}
    remap_ids(new_arr, mp)

    # 备份 + 写回
    bak = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'node_bak')
    os.makedirs(bak, exist_ok=True)
    dst = os.path.join(bak, os.path.basename(path) + '.' + time.strftime('%H%M%S') + '.bak')
    shutil.copy2(path, dst)
    json.dump(new_arr, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=indent,
              separators=(',', ': ') if indent else (',', ':'))
    print('%s: %d -> %d 元素（删节点 %d 个，含子树共 %d 元素）  备份=%s' % (
        os.path.basename(path), len(arr), len(new_arr), len(del_nodes), len(D), dst))
    return len(D)


if __name__ == '__main__':
    args = sys.argv[1:]
    i = 0
    total = 0
    while i < len(args):
        f = args[i]
        roots = [int(x) for x in args[i + 1].split(',')]
        total += process(f, roots)
        i += 2
    print('TOTAL removed elements:', total)
