"""drift_check.py —— prefab ↔ 运行期 漂移检查（第七十九轮新增）

用途：在编辑器里改了 XXX.prefab，想确认「跑起来真的按预制体来」；或者怀疑
「代码偷偷把节点挪回去了」，跑它一把就能定位到具体节点。

用法：
    python .workbuddy/tools/drift_check.py <cdp日志> [prefab根目录]

    <cdp日志>      E:/LDC_Fby/_cdp_log.txt（跑 _q79_prefab_drift.tpl 产出，
                   注意先 export CDP_LOG_MAX=40000，否则 dump 行会被截断）
    [prefab根目录] 默认 assets/resources/Prefabs/UI

日志里要找的是模板 dump 出来的这一行：
    ###OfflineDialog### card pos=(0.0,0.0) size=596x410 |   mask pos=...

判读口径（刻意区分「代码覆盖」和「本来就该动」）：
  · pos 必须逐节点一致（容差 0.5px）——**不一致就是有代码在覆盖预制体**；
  · size：Label（按文字算）、挂 cc.Widget 的节点（按可见区对齐）不比；
  · 已知按设计会动的三类，直接跳过并标注：
      - cc.Widget 平铺节点（root/mask：1440×2560 → 可见区高度）
      - ScrollView 的 content（引擎 `_calculateBoundary` 会把内容贴到视口左上）
      - 开关钮 knob / 音量条 fill（控件运行期状态，位置尺寸来自 @property）
"""
import json
import os
import re
import sys

ROW = re.compile(r'^(\s*)(\S.*?)\s+pos=\((-?[\d.]+),(-?[\d.]+)\)\s+size=(\S+)')
# 运行期状态节点：名字即约定（控件内部靠 @property 摆位，prefab 里的静态坐标只是「正中间」姿态）
DYNAMIC_NAMES = {'knob', 'fill'}


def parse_rows(s):
    """'名 pos=(x,y) size=WxH | ...' → {路径: (x, y, size)}（缩进 2 空格 = 一层）"""
    out, stack = {}, []
    for raw in s.split(' | '):
        m = ROW.match(raw)
        if not m:
            continue
        depth = len(m.group(1)) // 2
        stack = stack[:depth]
        stack.append(m.group(2))
        out['/'.join(stack)] = (float(m.group(3)), float(m.group(4)), m.group(5))
    return out


def prefab_rows(path):
    """读 prefab → {路径: dict(x, y, size, skip_pos, skip_size, note)}"""
    arr = json.load(open(path, 'r', encoding='utf-8'))
    out = {}

    def walk(idx, prefix, in_scroll):
        o = arr[idx]
        p = o.get('_lpos') or {}
        size, has_label, has_widget, has_scroll = '?', False, False, False
        for c in o.get('_components', []):
            t = arr[c['__id__']].get('__type__')
            if t == 'cc.UITransform':
                cs = arr[c['__id__']].get('_contentSize') or {}
                size = '%dx%d' % (round(cs.get('width', 0)), round(cs.get('height', 0)))
            elif t == 'cc.Label':
                has_label = True
            elif t == 'cc.Widget':
                has_widget = True
            elif t == 'cc.ScrollView':
                has_scroll = True
        name = o.get('_name', '?')
        key = (prefix + '/' + name) if prefix else name
        note = ''
        skip_pos = skip_size = False
        if has_label or has_widget:
            skip_size = True
            if has_widget:
                note = 'Widget 按可见区对齐'
        if in_scroll and name == 'content':
            skip_pos = True
            note = 'ScrollView 内容（引擎贴左上）'
        if name in DYNAMIC_NAMES:
            skip_pos = skip_size = True
            note = '控件运行期状态'
        out[key] = dict(x=p.get('x', 0), y=p.get('y', 0), size=size,
                        skip_pos=skip_pos, skip_size=skip_size, note=note)
        for c in o.get('_children', []):
            walk(c['__id__'], key, in_scroll or has_scroll)

    walk(arr[0]['data']['__id__'], '', False)
    return out


def main():
    log = sys.argv[1]
    root = sys.argv[2] if len(sys.argv) > 2 else 'assets/resources/Prefabs/UI'
    line = ''
    for ln in open(log, 'r', encoding='utf-8', errors='replace'):
        if '###' in ln and '[eval]' in ln:
            line = ln
    if not line:
        print('没在日志里找到 dump 行 —— 先跑 _workbench/_tpl/_q79_prefab_drift.tpl')
        return 1
    raw = line.split('[eval]', 1)[1].strip()
    try:
        body = json.loads(raw)['result']['value']
    except Exception as ex:
        print('dump 行解析失败（大概率被截断了，先 export CDP_LOG_MAX=40000 重跑）:', ex)
        return 1

    bad = 0
    for sec in body.split(' ~~~~ '):
        if not sec.startswith('###'):
            continue
        name = sec[3:sec.index('###', 3)]
        runtime = parse_rows(sec.split('###', 2)[2].strip())
        pf_path = os.path.join(root, name + '.prefab')
        if not os.path.exists(pf_path):
            print('[skip] 没有预制体:', pf_path)
            continue
        prefab = prefab_rows(pf_path)
        diffs, skipped = [], 0
        for k, d in prefab.items():
            if k not in runtime:
                diffs.append('  缺失(运行期没有): %s' % k)
                continue
            rx, ry, rsize = runtime[k]
            if not d['skip_pos'] and (abs(rx - d['x']) > 0.5 or abs(ry - d['y']) > 0.5):
                diffs.append('  位置漂移: %-42s prefab=(%.1f,%.1f) runtime=(%.1f,%.1f)'
                             % (k, d['x'], d['y'], rx, ry))
            elif not d['skip_size'] and d['size'] != '?' and rsize != '?' and d['size'] != rsize:
                diffs.append('  尺寸漂移: %-42s prefab=%s runtime=%s' % (k, d['size'], rsize))
            elif d['skip_pos'] or d['skip_size']:
                skipped += 1
        extra = [k for k in runtime if k not in prefab]
        head = 'OK 无漂移' if not diffs else '发现 %d 处漂移' % len(diffs)
        print('=== %-14s === %s（按设计跳过 %d 个动态节点）' % (name, head, skipped))
        for d in diffs:
            print(d)
        if extra:
            print('  运行期多出（正常，运行时生成的）: %s' % ', '.join(extra))
        bad += len(diffs)
    print('---- 合计漂移 %d 处 ----' % bad)
    return 0


if __name__ == '__main__':
    sys.exit(main())
