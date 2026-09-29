"""recolor_dialog_rows.py —— 统计/成就/设置弹窗「选项行」由深棕改奶油底（第110轮）。

规则（只动 StatsDialog / AchDialog / SettingDialog 三个 prefab）：
  Sprite（按节点名）：
    row_* / bot_* / ach_* / toggle_* / step_* / card_*  #5C4420 → #F6E3C5（行底）
    dec / inc / lang_zh / lang_en                        #F6E3C5 → #FFF7E6（浅底上要浮出来）
  Label（按颜色）：
    #F1E0C0 → #7A4210（行标题/说明：浅底配深棕字）
    #F2C34E → #C9902C（金色数值压深一档）
    #8CE7A2 → #3E8E4C（绿色数值压深）
    #C0B096 → #8A5A28（成就描述）
  AchDialog 里 Label 'title' 的 #FFFFFF → #7A4210（编辑器所见即所得；运行时 AchRow 会覆盖）

用法：python recolor_dialog_rows.py   （幂等，可重复跑）
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FILES = [
    'assets/resources/Prefabs/UI/StatsDialog.prefab',
    'assets/resources/Prefabs/UI/AchDialog.prefab',
    'assets/resources/Prefabs/UI/SettingDialog.prefab',
]

ROW_PREFIX = ('row_', 'bot_', 'ach_', 'toggle_', 'step_', 'card_')
LIGHT_BTN = ('dec', 'inc', 'lang_zh', 'lang_en')

def C(hexstr):
    return (int(hexstr[0:2], 16), int(hexstr[2:4], 16), int(hexstr[4:6], 16), 255)

DARK_ROW = C('5C4420')
CREAM = C('F6E3C5')
CREAM_HI = C('FFF7E6')

LABEL_MAP = {
    C('F1E0C0'): C('7A4210'),   # 行标题/说明
    C('F2C34E'): C('C9902C'),   # 金色数值
    C('8CE7A2'): C('3E8E4C'),   # 绿色数值
    C('C0B096'): C('8A5A28'),   # 成就描述
}

def setc(comp, rgb):
    c = comp.get('_color')
    if not c:
        return False
    cur = (c.get('r', 0), c.get('g', 0), c.get('b', 0), c.get('a', 255))
    if cur == rgb:
        return False
    c['r'], c['g'], c['b'], c['a'] = rgb
    return True

total = {}
for rel in FILES:
    path = os.path.join(ROOT, rel)
    arr = json.load(open(path, 'r', encoding='utf-8'))
    n = 0
    for o in arr:
        if not isinstance(o, dict) or o.get('__type__') != 'cc.Node':
            continue
        name = o.get('_name', '')
        for cref in o.get('_components', []):
            comp = arr[cref['__id__']]
            t = comp.get('__type__')
            if t == 'cc.Sprite':
                if name.startswith(ROW_PREFIX) and setc(comp, CREAM):
                    n += 1
                elif name in LIGHT_BTN and setc(comp, CREAM_HI):
                    n += 1
            elif t == 'cc.Label':
                c = comp.get('_color')
                cur = (c.get('r', 0), c.get('g', 0), c.get('b', 0), c.get('a', 255)) if c else None
                if cur == C('FFFFFF') and 'AchDialog' in rel and name == 'title':
                    if setc(comp, C('7A4210')):
                        n += 1
                elif cur in LABEL_MAP and setc(comp, LABEL_MAP[cur]):
                    n += 1
    json.dump(arr, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    total[os.path.basename(rel)] = n
print('changed:', total)
