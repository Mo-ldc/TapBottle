# -*- coding: utf-8 -*-
"""UpgradeRow.prefab：ic 节点对齐 tierBg（ztk 底框）中心。
第三十八轮「所有行都进底框」后，prefab 里 ic 仍是旧坐标 (-127.157, 0.317)，
与 tierBg 中心 (-136, -6) 偏右 9px / 偏上 6px → 视觉上瓶身偏右上不居中。
"""
import os, shutil

P = 'assets/resources/Prefabs/UI/UpgradeRow.prefab'
BAK = '.workbuddy/prefab_bak/UpgradeRow.prefab.pre_ic_align.bak'

os.makedirs(os.path.dirname(BAK), exist_ok=True)
if not os.path.exists(BAK):
    shutil.copy2(P, BAK)

s = open(P, encoding='utf-8').read()

# 定点替换 ic 节点的 _lpos（-127.157/0.317 全文件唯一，双保险再断言一次）
old = '"x": -127.157,\n      "y": 0.317,'
new = '"x": -136,\n      "y": -6,'
assert s.count(old) == 1, 'ic _lpos anchor not unique: %d' % s.count(old)
s = s.replace(old, new)

open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('ok: ic -> (-136,-6); backup at', BAK)
