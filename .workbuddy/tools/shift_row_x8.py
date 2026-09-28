# -*- coding: utf-8 -*-
"""UpgradeRow.prefab：tierBg / ic / badgeIc 随第四十一轮布局右移 8px。
代码侧 UpgradeRows.ts 已把这三个节点位置改为按常量强制摆放（applyRow），
这里同步 prefab 序列化值，保证编辑器里打开 prefab 看到的也是新位置。
"""
import os, shutil

P = 'assets/resources/Prefabs/UI/UpgradeRow.prefab'
BAK = '.workbuddy/prefab_bak/UpgradeRow.prefab.pre_shift8.bak'

os.makedirs(os.path.dirname(BAK), exist_ok=True)
if not os.path.exists(BAK):
    shutil.copy2(P, BAK)

s = open(P, encoding='utf-8').read()

def patch_node(name, old_x, new_x, old_y, new_y):
    """按 _name 定位节点块，替换其后第一个 _lpos 的 x/y。"""
    global s
    i = s.find('"_name": "%s"' % name)
    assert i > 0, 'node %s not found' % name
    j = s.find('"_lpos"', i)
    assert j > 0 and j - i < 600, '_lpos far from %s' % name
    seg_old = '"x": %s,\n      "y": %s,' % (old_x, old_y)
    seg_new = '"x": %s,\n      "y": %s,' % (new_x, new_y)
    assert s[j:j+200].count(seg_old) == 1, '%s _lpos mismatch: %r' % (name, s[j:j+200])
    s = s[:j] + s[j:].replace(seg_old, seg_new, 1)
    print('patched %s: (%s,%s) -> (%s,%s)' % (name, old_x, old_y, new_x, new_y))

patch_node('tierBg', '-136', '-128', '-6', '-6')
patch_node('ic',     '-136', '-128', '-6', '-6')
patch_node('badgeIc', '-120', '-112', '-24', '-24')

open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('backup at', BAK)
