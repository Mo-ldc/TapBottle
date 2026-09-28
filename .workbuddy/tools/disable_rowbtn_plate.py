# -*- coding: utf-8 -*-
"""
第三十九轮：把 UpgradeRow.prefab 里价格区（节点名 btn，对象 id 44）的 Sprite 底框禁用。

为什么不删组件：手写 prefab 的 `__id__` 是数组下标，删/插都要全量 remap（极易写坏）。
禁用只改一个布尔字段，结构零变动，编辑器打开也看到「价格标签无底板」。

⚠️ 文本级替换而不是 json 重写：编辑器保存过的 prefab 是多行美化格式，
   json.dump 重写会把整个文件压成另一种排版（diff 巨大且丢失原格式）。
   这里锚定 「cc.Sprite + node id 44 + _enabled: true」这条唯一组合做定点替换。
"""
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PREFAB = os.path.join(ROOT, 'assets', 'resources', 'Prefabs', 'UI', 'UpgradeRow.prefab')
BAK_DIR = os.path.join(ROOT, '.workbuddy', 'prefab_bak')

NODE_NAME = 'btn'


def main():
    src = open(PREFAB, encoding='utf-8').read()
    data = json.loads(src)

    # 按名字找节点下标（不写死 44，prefab 改过结构也能跑）
    idx = None
    for i, o in enumerate(data):
        if isinstance(o, dict) and o.get('__type__') == 'cc.Node' and o.get('_name') == NODE_NAME:
            idx = i
            break
    if idx is None:
        print('!! 没找到节点', NODE_NAME)
        return 1

    old = ('    "__type__": "cc.Sprite",\n'
           '    "_name": "",\n'
           '    "_objFlags": 0,\n'
           '    "__editorExtras__": {},\n'
           '    "node": {\n'
           '      "__id__": %d\n'
           '    },\n'
           '    "_enabled": true,' % idx)
    hits = src.count(old)
    print('节点下标 =', idx, '| 锚点命中 =', hits)
    if hits != 1:
        print('!! 锚点不唯一，放弃（避免误改别的 Sprite）')
        return 1

    os.makedirs(BAK_DIR, exist_ok=True)
    shutil.copy2(PREFAB, os.path.join(BAK_DIR, 'UpgradeRow.prefab.bak'))
    new = old.replace('"_enabled": true,', '"_enabled": false,')
    open(PREFAB, 'w', encoding='utf-8').write(src.replace(old, new))

    # 复核：解析回来确认那个 Sprite 确实 disabled，且文件仍是合法 JSON
    chk = json.loads(open(PREFAB, encoding='utf-8').read())
    sp = None
    for o in chk:
        if isinstance(o, dict) and o.get('__type__') == 'cc.Sprite' and o.get('node', {}).get('__id__') == idx:
            sp = o
    print('复核 btn Sprite _enabled =', sp.get('_enabled') if sp else 'NOT FOUND')
    print('备份 ->', os.path.join(BAK_DIR, 'UpgradeRow.prefab.bak'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
