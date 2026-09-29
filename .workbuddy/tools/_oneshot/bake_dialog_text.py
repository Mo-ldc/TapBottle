# -*- coding: utf-8 -*-
"""
第七十一轮：把弹窗文案写进 prefab 本体（美术可在编辑器里直接看到字并调字号）。

背景：ConfirmDialog / OfflineDialog 的文本原先只有部分写死在 prefab，
其余靠脚本运行时填（ConfirmDialog 全部为空 / OfflineDialog 的 time/earn/capLb 为空），
美术打开 prefab 看不到字形，无法对字号与排版。

本脚本只改 `cc.Label._string`，**不动任何结构**（不增删节点/组件，不重排数组），
所以 prefab 三件套、_id、fileId 全部保持原样。

运行时行为不变：ConfirmDialog.init() 与 OfflineDialog.render() 仍会覆盖文本（多语言），
LocLabel(key) 也会在 onLoad 覆盖。prefab 里的值只作编辑器预览与字号排版参考。

用法：
    python .workbuddy/tools/bake_dialog_text.py          # 干跑
    python .workbuddy/tools/bake_dialog_text.py --write  # 写回
"""
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UI = os.path.join(ROOT, 'assets', 'resources', 'Prefabs', 'UI')
BAK = os.path.join(ROOT, '.workbuddy', 'prefab_bak')

# (prefab 文件名, 父节点路径, label 节点名, 新文案)
# 父节点路径用 "a/b" 表示，空串表示根下直接子节点
EDITS = [
    ('ConfirmDialog.prefab', 'fit/card', 'text', '重新开始游戏将会丢失现有的所有进度和升级。'),
    ('ConfirmDialog.prefab', 'fit/card', 'question', '确定重新开始吗？'),
    ('ConfirmDialog.prefab', 'fit/card/okBtn', 'text', '确认'),
    ('ConfirmDialog.prefab', 'fit/card/cancelBtn', 'text', '取消'),
    ('OfflineDialog.prefab', 'fit/card', 'time', '您已离线2小时40分钟，可获得'),
    ('OfflineDialog.prefab', 'fit/card', 'earn', '金币：$ 1.2K'),
    ('OfflineDialog.prefab', 'fit/card', 'capLb', '瓶盖：30'),
    ('OfflineDialog.prefab', 'fit/card/okBtn', 'text', '基础领取'),
    ('OfflineDialog.prefab', 'fit/card/adBtn', 'text', '三倍领取'),
]


def load(path):
    with io.open(path, encoding='utf-8') as f:
        return json.load(f)


def save(path, arr):
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(arr, ensure_ascii=False, separators=(',', ':')))


def resolve(arr, path):
    """按 'card/okBtn/text' 形式的相对路径找到节点 index（根 = arr[1]）"""
    cur = 1
    for seg in [s for s in path.split('/') if s]:
        found = None
        for c in arr[cur].get('_children', []):
            ci = c['__id__']
            if arr[ci].get('_name') == seg:
                found = ci
                break
        if found is None:
            raise KeyError('node not found: %s (under %s)' % (seg, cur))
        cur = found
    return cur


def main():
    write = '--write' in sys.argv
    plan = []
    cache = {}   # ★ 同一 prefab 必须共用同一份数组对象，否则逐个 load 会互相覆盖
    for name, parent, label_node, text in EDITS:
        p = os.path.join(UI, name)
        if p not in cache:
            cache[p] = load(p)
        arr = cache[p]
        nid = resolve(arr, (parent + '/' + label_node) if parent else label_node)
        lid = None
        for c in arr[nid].get('_components', []):
            ci = c['__id__']
            if arr[ci].get('__type__') == 'cc.Label':
                lid = ci
                break
        if lid is None:
            raise KeyError('label not found on %s/%s/%s' % (name, parent, label_node))
        old = arr[lid].get('_string', '')
        fs = arr[lid].get('_fontSize')
        ov = arr[lid].get('_overflow')
        plan.append((name, '%s/%s' % (parent, label_node), old, text, fs, ov, p, lid, arr))

    print('=== 计划改动 %d 处 ===' % len(plan))
    for name, path, old, new, fs, ov, _, lid, _a in plan:
        flag = '  ' if old == new else '→ '
        print('%-22s %-18s fs=%-3s ov=%s   %r %s %r' % (name, path, fs, ov, old, flag, new))

    if not write:
        print('\n[干跑] 未写盘。加 --write 生效。')
        return

    if not os.path.isdir(BAK):
        os.makedirs(BAK)
    touched = set()
    for name, path, old, new, fs, ov, p, lid, arr in plan:
        arr[lid]['_string'] = new
        touched.add(p)
    for p in sorted(touched):
        bak = os.path.join(BAK, os.path.basename(p) + '.pre_text')
        if not os.path.exists(bak):
            shutil.copy2(p, bak)
        save(p, cache[p])
        print('written %s  (backup %s)' % (os.path.basename(p), os.path.basename(bak)))
    print('done.')


if __name__ == '__main__':
    main()
